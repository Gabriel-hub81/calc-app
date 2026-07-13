#!/usr/bin/env node
/**
 * Mide la accuracy del motor contra Gemini REAL usando tests/test_cases.json.
 * Requiere GEMINI_API_KEY en el entorno (.env local o Secret Manager).
 *
 * Uso:
 *   npm run accuracy               # corre todos los casos
 *   npm run accuracy -- --pending  # solo casos aún no aprobados (reanudar tras
 *                                  # agotar cuota — los aprobados se cargan de
 *                                  # tests/accuracy_results.json)
 *
 * Salida: reporte en consola + tests/accuracy_report.md + tests/accuracy_results.json
 *
 * Criterios:
 * - Caso normal: pasa si |resultado - esperado| <= max(0.01, 0.5% del esperado)
 * - Caso ambiguous: pasa si el motor devuelve "ambiguo" (preguntar > adivinar)
 * - Caso error: pasa si el motor devuelve "error" (incluye división por cero,
 *   que detecta el evaluador)
 * - Los errores en casos con es_dinero=true se reportan aparte: la meta ahí es CERO.
 *
 * Cuotas free tier: ~5 req/min y 20 req/día por modelo. El script espacia las
 * llamadas, reintenta los límites por minuto, y ABORTA limpio si se agota la
 * cuota diaria (reintentar es inútil hasta el reset, ~medianoche hora del
 * Pacífico). Con billing activo: ACCURACY_DELAY_MS=0 npm run accuracy
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { parseTexto, MODEL } = require('../src/services/gemini');
const { evaluateExpression, EvaluationError } = require('../src/services/evaluator');

const CASES_PATH = path.join(__dirname, '..', 'tests', 'test_cases.json');
const REPORT_PATH = path.join(__dirname, '..', 'tests', 'accuracy_report.md');
const RESULTS_PATH = path.join(__dirname, '..', 'tests', 'accuracy_results.json');

const DELAY_MS = process.env.ACCURACY_DELAY_MS !== undefined
  ? Number(process.env.ACCURACY_DELAY_MS)
  : 13000;
const ONLY_PENDING = process.argv.includes('--pending');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class DailyQuotaError extends Error {}

async function parseWithRetry(input, maxRetries = 4) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await parseTexto(input);
    } catch (err) {
      const msg = String(err.message || err);
      const is429 = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
      const is503 = msg.includes('503') || msg.includes('UNAVAILABLE');
      // Servicio degradado: JSON truncado/corrupto (gemini.js ya reintentó 2x internamente)
      const isBadJson = err instanceof SyntaxError || /JSON/i.test(msg);
      // Cuota DIARIA agotada: reintentar no sirve — abortamos la corrida
      if (is429 && msg.includes('PerDay')) {
        throw new DailyQuotaError('Cuota diaria del free tier agotada (20 req/día por modelo).');
      }
      if (attempt >= maxRetries || (!is429 && !is503 && !isBadJson)) throw err;
      const m = msg.match(/retry in ([\d.]+)s/i) || msg.match(/"retryDelay":"(\d+(?:\.\d+)?)s"/);
      const wait = m ? (parseFloat(m[1]) + 2) * 1000 : is429 ? 62000 : isBadJson ? 5000 : 20000;
      console.log(`   ⏳ ${isBadJson ? 'JSON inválido del modelo' : `límite de API (${is429 ? '429' : '503'})`} — reintento en ${Math.round(wait / 1000)}s (${attempt + 1}/${maxRetries})`);
      await sleep(wait);
    }
  }
}

function numericPass(got, expected) {
  const tolerance = Math.max(0.01, Math.abs(expected) * 0.005);
  return Math.abs(got - expected) <= tolerance;
}

async function runCase(c) {
  let parsed;
  try {
    parsed = await parseWithRetry(c.input);
  } catch (err) {
    if (err instanceof DailyQuotaError) throw err;
    return { ...c, outcome: 'api_failure', detail: err.message, pass: false };
  }

  if (c.ambiguous) {
    const pass = parsed.tipo === 'ambiguo';
    return { ...c, outcome: parsed.tipo, detail: parsed.mensaje || parsed.expresion, pass };
  }

  if (c.error) {
    if (parsed.tipo === 'error') return { ...c, outcome: 'error', pass: true };
    if (parsed.tipo === 'ok') {
      // división por cero y similares: Gemini puede devolver la expresión
      // y es el evaluador quien la rechaza — eso también cuenta como detectado
      try {
        const val = evaluateExpression(parsed.expresion, Boolean(parsed.es_dinero));
        return { ...c, outcome: 'ok', detail: `devolvió ${val} (${parsed.expresion})`, pass: false };
      } catch (err) {
        if (err instanceof EvaluationError) return { ...c, outcome: 'error_evaluador', pass: true };
        throw err;
      }
    }
    return { ...c, outcome: parsed.tipo, detail: parsed.mensaje, pass: false };
  }

  // Capa 1.5: frases en pasado ("compré 5 cosas a 12.50") son intent register —
  // comportamiento correcto. Si el caso espera un número, sumamos los items
  // EN CÓDIGO (como hace el ledger en producción) y comparamos.
  if (parsed.intent === 'register') {
    const items = parsed.registro?.items || [];
    if (items.length > 0 && typeof c.expected_result === 'number') {
      const total = items.reduce(
        (s, it) => s + (it.cantidad ?? 1) * (it.precio_unitario ?? 0),
        0
      );
      return {
        ...c,
        outcome: 'register',
        got: total,
        parsed_expression: `register: ${items.length} item(s)`,
        pass: numericPass(total, c.expected_result)
      };
    }
    return { ...c, outcome: 'register', detail: JSON.stringify(parsed.registro || {}), pass: false };
  }
  if (parsed.intent === 'query') {
    return { ...c, outcome: 'query', pass: false };
  }

  // caso numérico normal
  if (parsed.tipo !== 'ok') {
    return { ...c, outcome: parsed.tipo, detail: parsed.mensaje, pass: false };
  }
  let got;
  try {
    got = evaluateExpression(parsed.expresion, Boolean(parsed.es_dinero));
  } catch (err) {
    return { ...c, outcome: 'error_evaluador', detail: `${parsed.expresion}: ${err.message}`, pass: false };
  }
  return {
    ...c,
    outcome: 'ok',
    got,
    parsed_expression: parsed.expresion,
    pass: numericPass(got, c.expected_result)
  };
}

function loadPreviousResults() {
  if (!fs.existsSync(RESULTS_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf8'));
  } catch {
    return {};
  }
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error('Falta GEMINI_API_KEY. Crea backend/.env con tu key (ver .env.example).');
    process.exit(1);
  }

  const cases = JSON.parse(fs.readFileSync(CASES_PATH, 'utf8'));
  const previous = ONLY_PENDING ? loadPreviousResults() : {};
  const cachedIds = new Set(
    cases.filter((c) => previous[c.id] && previous[c.id].pass === true).map((c) => c.id)
  );

  console.log(`Midiendo accuracy con modelo ${MODEL} — ${cases.length} casos` +
    (ONLY_PENDING ? ` (${cachedIds.size} ya aprobados, se omiten)` : '') + '...\n');

  const results = [];
  let dailyQuotaHit = false;
  let firstLiveCall = true;

  for (const c of cases) {
    if (cachedIds.has(c.id)) {
      results.push({ ...c, ...previous[c.id], cached: true });
      console.log(`✓ [${c.id}] "${c.input}"  (aprobado en corrida anterior)`);
      continue;
    }
    if (dailyQuotaHit) {
      results.push({ ...c, outcome: 'skipped_quota', pass: null });
      continue;
    }
    if (!firstLiveCall && DELAY_MS > 0) await sleep(DELAY_MS);
    firstLiveCall = false;

    let r;
    try {
      r = await runCase(c);
    } catch (err) {
      if (err instanceof DailyQuotaError) {
        console.log(`\n⛔ ${err.message} Los casos restantes quedan pendientes — reanuda mañana con: npm run accuracy -- --pending`);
        dailyQuotaHit = true;
        results.push({ ...c, outcome: 'skipped_quota', pass: null });
        continue;
      }
      throw err;
    }
    results.push(r);
    const mark = r.pass ? '✓' : '✗';
    const extra = r.pass ? '' : `  ← esperado: ${r.expected_result ?? (r.ambiguous ? 'ambiguo' : 'error')}, obtuvo: ${r.outcome}${r.got !== undefined ? ` (${r.got})` : ''} ${r.detail || ''}`;
    console.log(`${mark} [${r.id}] "${r.input}"${extra}`);
  }

  // Persistir resultados medidos (merge con corridas anteriores)
  const merged = { ...loadPreviousResults() };
  for (const r of results) {
    if (r.outcome === 'skipped_quota') continue;
    merged[r.id] = {
      pass: r.pass,
      outcome: r.outcome,
      got: r.got,
      parsed_expression: r.parsed_expression,
      detail: r.detail,
      model: MODEL,
      measured_at: new Date().toISOString()
    };
  }
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(merged, null, 2));

  const measured = results.filter((r) => r.outcome !== 'skipped_quota');
  const skipped = results.length - measured.length;
  const passed = measured.filter((r) => r.pass).length;
  const accuracy = measured.length ? ((passed / measured.length) * 100).toFixed(1) : 'n/a';

  const moneyMeasured = measured.filter((r) => r.es_dinero);
  const moneyFails = moneyMeasured.filter((r) => !r.pass);

  const heldOut = measured.filter((r) => !r.few_shot);
  const heldOutPassed = heldOut.filter((r) => r.pass).length;
  const heldOutAccuracy = heldOut.length
    ? ((heldOutPassed / heldOut.length) * 100).toFixed(1)
    : 'n/a';

  console.log('\n──────────────────────────────────────');
  console.log(`Casos medidos:       ${measured.length}/${results.length}${skipped ? `  (${skipped} pendientes por cuota diaria)` : ''}`);
  console.log(`Accuracy (medidos):  ${passed}/${measured.length} (${accuracy}%)`);
  console.log(`Accuracy held-out:   ${heldOutPassed}/${heldOut.length} (${heldOutAccuracy}%)  ← casos fuera del few-shot (la métrica honesta)`);
  console.log(`Errores en dinero:   ${moneyFails.length}/${moneyMeasured.length} medidos  ← la meta aquí es CERO`);
  console.log('──────────────────────────────────────');

  const failures = measured.filter((r) => !r.pass);
  const lines = [
    '# CALC — Reporte de Accuracy',
    '',
    `- Fecha: ${new Date().toISOString()}`,
    `- Modelo: ${MODEL}`,
    `- Casos medidos: **${measured.length}/${results.length}**${skipped ? ` (${skipped} pendientes por cuota diaria del free tier)` : ''}`,
    `- Accuracy sobre medidos: **${passed}/${measured.length} (${accuracy}%)**`,
    `- Accuracy held-out (fuera del few-shot): **${heldOutPassed}/${heldOut.length} (${heldOutAccuracy}%)**`,
    `- Errores en casos de dinero medidos: **${moneyFails.length}/${moneyMeasured.length}** (meta: 0)`,
    '',
    '## Fallas',
    '',
    failures.length === 0
      ? '_Ninguna._'
      : failures
          .map(
            (r) =>
              `- \`${r.id}\` — "${r.input}" → esperado: ${r.expected_result ?? (r.ambiguous ? 'ambiguo' : 'error')}, obtuvo: ${r.outcome}${r.got !== undefined ? ` (${r.got})` : ''}${r.detail ? ` — ${r.detail}` : ''}`
          )
          .join('\n'),
    '',
    skipped
      ? `## Pendientes por cuota\n\n${results.filter((r) => r.outcome === 'skipped_quota').map((r) => `- \`${r.id}\` — "${r.input}"`).join('\n')}\n\nReanudar con: \`npm run accuracy -- --pending\``
      : '',
    ''
  ];
  fs.writeFileSync(REPORT_PATH, lines.join('\n'));
  console.log(`\nReporte: ${path.relative(process.cwd(), REPORT_PATH)} · Resultados: ${path.relative(process.cwd(), RESULTS_PATH)}`);

  if (moneyFails.length > 0) {
    console.error('\n⚠ HAY ERRORES EN CASOS DE DINERO — tolerancia cero. Ajustar prompt/few-shot antes de avanzar.');
    process.exit(2);
  }
  if (measured.length && passed / measured.length < 0.9) {
    console.error('\n⚠ Accuracy por debajo del umbral de la sesión (90%). Ajustar prompt/few-shot.');
    process.exit(3);
  }
  if (skipped > 0) {
    console.error('\nℹ Corrida incompleta por cuota diaria — sin fallas hasta ahora. Reanudar mañana con --pending.');
    process.exit(4);
  }
}

main().catch((err) => {
  console.error('Fallo inesperado:', err);
  process.exit(1);
});
