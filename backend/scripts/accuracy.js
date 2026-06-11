#!/usr/bin/env node
/**
 * Mide la accuracy del motor contra Gemini REAL usando tests/test_cases.json.
 * Requiere GEMINI_API_KEY en el entorno (.env local o Secret Manager).
 *
 * Uso: npm run accuracy
 * Salida: reporte en consola + tests/accuracy_report.md
 *
 * Criterios:
 * - Caso normal: pasa si |resultado - esperado| <= max(0.01, 0.5% del esperado)
 * - Caso ambiguous: pasa si el motor devuelve "ambiguo" (preguntar > adivinar)
 * - Caso error: pasa si el motor devuelve "error" (incluye división por cero,
 *   que detecta el evaluador)
 * - Los errores en casos con es_dinero=true se reportan aparte: la meta ahí es CERO.
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { parseTexto, MODEL } = require('../src/services/gemini');
const { evaluateExpression, EvaluationError } = require('../src/services/evaluator');

const CASES_PATH = path.join(__dirname, '..', 'tests', 'test_cases.json');
const REPORT_PATH = path.join(__dirname, '..', 'tests', 'accuracy_report.md');

function numericPass(got, expected) {
  const tolerance = Math.max(0.01, Math.abs(expected) * 0.005);
  return Math.abs(got - expected) <= tolerance;
}

async function runCase(c) {
  let parsed;
  try {
    parsed = await parseTexto(c.input);
  } catch (err) {
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

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error('Falta GEMINI_API_KEY. Crea backend/.env con tu key (ver .env.example).');
    process.exit(1);
  }

  const cases = JSON.parse(fs.readFileSync(CASES_PATH, 'utf8'));
  console.log(`Midiendo accuracy con modelo ${MODEL} — ${cases.length} casos...\n`);

  const results = [];
  for (const c of cases) {
    const r = await runCase(c);
    results.push(r);
    const mark = r.pass ? '✓' : '✗';
    const extra = r.pass ? '' : `  ← esperado: ${r.expected_result ?? (r.ambiguous ? 'ambiguo' : 'error')}, obtuvo: ${r.outcome}${r.got !== undefined ? ` (${r.got})` : ''} ${r.detail || ''}`;
    console.log(`${mark} [${r.id}] "${r.input}"${extra}`);
  }

  const total = results.length;
  const passed = results.filter((r) => r.pass).length;
  const accuracy = ((passed / total) * 100).toFixed(1);

  const moneyCases = results.filter((r) => r.es_dinero);
  const moneyFails = moneyCases.filter((r) => !r.pass);

  const fewShotResults = results.filter((r) => r.few_shot);
  const heldOutResults = results.filter((r) => !r.few_shot);
  const heldOutPassed = heldOutResults.filter((r) => r.pass).length;
  const heldOutAccuracy = heldOutResults.length
    ? ((heldOutPassed / heldOutResults.length) * 100).toFixed(1)
    : 'n/a';

  console.log('\n──────────────────────────────────────');
  console.log(`Accuracy total:      ${passed}/${total} (${accuracy}%)`);
  console.log(`Accuracy held-out:   ${heldOutPassed}/${heldOutResults.length} (${heldOutAccuracy}%)  ← casos que NO están en el few-shot (la métrica honesta)`);
  console.log(`Errores en dinero:   ${moneyFails.length}/${moneyCases.length}  ← la meta aquí es CERO`);
  console.log('──────────────────────────────────────');

  const failures = results.filter((r) => !r.pass);
  const lines = [
    '# CALC — Reporte de Accuracy',
    '',
    `- Fecha: ${new Date().toISOString()}`,
    `- Modelo: ${MODEL}`,
    `- Accuracy total: **${passed}/${total} (${accuracy}%)**`,
    `- Accuracy held-out (casos fuera del few-shot): **${heldOutPassed}/${heldOutResults.length} (${heldOutAccuracy}%)**`,
    `- Errores en casos de dinero: **${moneyFails.length}/${moneyCases.length}** (meta: 0)`,
    `- Few-shot en el prompt: ${fewShotResults.length} casos (su accuracy está inflada por definición)`,
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
    ''
  ];
  fs.writeFileSync(REPORT_PATH, lines.join('\n'));
  console.log(`\nReporte guardado en ${path.relative(process.cwd(), REPORT_PATH)}`);

  if (moneyFails.length > 0) {
    console.error('\n⚠ HAY ERRORES EN CASOS DE DINERO — tolerancia cero. Ajustar prompt/few-shot antes de avanzar.');
    process.exit(2);
  }
  if (passed / total < 0.9) {
    console.error('\n⚠ Accuracy por debajo del umbral de la sesión (90%). Ajustar prompt/few-shot.');
    process.exit(3);
  }
}

main().catch((err) => {
  console.error('Fallo inesperado:', err);
  process.exit(1);
});
