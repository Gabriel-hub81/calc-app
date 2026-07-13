#!/usr/bin/env node
/**
 * Valida el dataset sintético (tests/synthetic_dataset/*.jsonl) SIN confiar
 * en aritmética de ningún LLM:
 *
 * 1. Valida schema y vocabulario de expresiones (mismo regex del evaluador).
 * 2. CALCULA expected_result con mathjs desde expected_expression o sumando
 *    register_items — la misma ruta que producción. Lo calculado ES la verdad
 *    del test; nada que haya calculado un LLM entra al dataset.
 * 3. Deduplica inputs casi idénticos (dentro de cada lote y entre modelos).
 * 4. Genera dataset_stats.json y validated_dataset.jsonl (el merge limpio).
 * 5. Marca para revisión manual SOLO los casos raros (schema roto, expresión
 *    rechazada, ambiguous sin clarification, duplicados).
 *
 * Uso: node scripts/validate_dataset.js
 * Exit: 0 si todo válido; 1 si hay casos marcados para revisión.
 */
const fs = require('fs');
const path = require('path');
const { evaluateExpression, EvaluationError } = require('../src/services/evaluator');

const DATASET_DIR = path.join(__dirname, '..', 'tests', 'synthetic_dataset');
const STATS_PATH = path.join(DATASET_DIR, 'dataset_stats.json');
const MERGED_PATH = path.join(DATASET_DIR, 'validated_dataset.jsonl');

const INTENTS = new Set(['calc', 'register', 'query', 'ambiguous', 'error']);
const REGISTER_TIPOS = new Set(['venta', 'compra', 'gasto']);
const DIFFICULTIES = new Set(['easy', 'medium', 'hard']);

// Para dedup: minúsculas, sin tildes, sin puntuación, espacios colapsados.
function normalizeInput(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function validateExample(ex, source, line) {
  const problems = [];
  const out = { ...ex, source, line };

  if (!ex.input || typeof ex.input !== 'string' || ex.input.trim().length < 3) {
    problems.push('input vacío o demasiado corto');
  }
  if (!INTENTS.has(ex.intent)) {
    problems.push(`intent inválido: ${ex.intent}`);
  }
  if (ex.expected_result !== undefined) {
    // Regla crítica #1: los generadores JAMÁS entregan resultados
    problems.push('trae expected_result de un LLM — prohibido, se descarta el campo');
    delete out.expected_result;
  }
  if (ex.difficulty !== undefined && !DIFFICULTIES.has(ex.difficulty)) {
    problems.push(`difficulty inválida: ${ex.difficulty}`);
  }
  if (!Array.isArray(ex.tags)) {
    problems.push('tags ausente o no es lista');
  }

  const esDinero = Array.isArray(ex.tags) && ex.tags.includes('money');

  switch (ex.intent) {
    case 'calc': {
      if (!ex.expected_expression || typeof ex.expected_expression !== 'string') {
        problems.push('calc sin expected_expression');
        break;
      }
      try {
        // La ÚNICA fuente de verdad numérica: el mismo evaluador de producción
        out.expected_result = evaluateExpression(ex.expected_expression, esDinero);
      } catch (err) {
        if (err instanceof EvaluationError) {
          problems.push(`expresión rechazada por el evaluador: "${ex.expected_expression}" (${err.message})`);
        } else {
          throw err;
        }
      }
      break;
    }
    case 'register': {
      if (!REGISTER_TIPOS.has(ex.register_tipo)) {
        problems.push(`register_tipo inválido: ${ex.register_tipo}`);
      }
      const items = ex.register_items;
      if (!Array.isArray(items) || items.length === 0) {
        problems.push('register sin register_items');
        break;
      }
      let total = 0;
      for (const [i, it] of items.entries()) {
        if (!it.nombre || typeof it.nombre !== 'string') problems.push(`item ${i}: sin nombre`);
        if (!(typeof it.cantidad === 'number' && it.cantidad > 0)) problems.push(`item ${i}: cantidad inválida`);
        if (!(typeof it.precio_unitario === 'number' && it.precio_unitario >= 0)) problems.push(`item ${i}: precio_unitario inválido`);
        if (it.costo_unitario !== undefined && !(typeof it.costo_unitario === 'number' && it.costo_unitario >= 0)) {
          problems.push(`item ${i}: costo_unitario inválido`);
        }
        total += (it.cantidad ?? 0) * (it.precio_unitario ?? 0);
      }
      // Total EN CÓDIGO — como lo hace el ledger en producción
      if (problems.length === 0) out.expected_total = Math.round(total * 100) / 100;
      break;
    }
    case 'ambiguous': {
      if (!ex.clarification || typeof ex.clarification !== 'string') {
        problems.push('ambiguous sin clarification');
      }
      break;
    }
    case 'query':
    case 'error':
      break;
    default:
      break;
  }

  return { out, problems };
}

function main() {
  if (!fs.existsSync(DATASET_DIR)) {
    console.error(`No existe ${DATASET_DIR} — genera primero algún lote .jsonl`);
    process.exit(1);
  }
  const files = fs.readdirSync(DATASET_DIR)
    .filter((f) => f.endsWith('.jsonl') && f !== path.basename(MERGED_PATH))
    .sort();
  if (files.length === 0) {
    console.error('No hay archivos .jsonl que validar.');
    process.exit(1);
  }

  const valid = [];
  const flagged = [];
  const seen = new Map(); // input normalizado → primera fuente

  for (const file of files) {
    const lines = fs.readFileSync(path.join(DATASET_DIR, file), 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    for (const [idx, line] of lines.entries()) {
      let ex;
      try {
        ex = JSON.parse(line);
      } catch {
        flagged.push({ source: file, line: idx + 1, problems: ['JSON inválido'], input: line.slice(0, 80) });
        continue;
      }
      const { out, problems } = validateExample(ex, file, idx + 1);

      const key = normalizeInput(ex.input || '');
      if (key && seen.has(key)) {
        problems.push(`duplicado de ${seen.get(key)}`);
      } else if (key) {
        seen.set(key, `${file}:${idx + 1}`);
      }

      if (problems.length > 0) {
        flagged.push({ source: file, line: idx + 1, problems, input: ex.input });
      } else {
        valid.push(out);
      }
    }
  }

  // Estadísticas de distribución
  const count = (arr, fn) => arr.reduce((m, x) => {
    const k = fn(x);
    if (k !== undefined) m[k] = (m[k] || 0) + 1;
    return m;
  }, {});
  const stats = {
    generated_at: new Date().toISOString(),
    files,
    total_valid: valid.length,
    total_flagged: flagged.length,
    by_file: count(valid, (x) => x.source),
    by_intent: count(valid, (x) => x.intent),
    by_difficulty: count(valid, (x) => x.difficulty),
    by_tag: valid.flatMap((x) => x.tags || []).reduce((m, t) => ((m[t] = (m[t] || 0) + 1), m), {}),
    flagged
  };

  fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2));
  fs.writeFileSync(MERGED_PATH, valid.map((x) => JSON.stringify(x)).join('\n') + '\n');

  console.log(`Archivos: ${files.join(', ')}`);
  console.log(`Válidos:  ${valid.length}   Marcados: ${flagged.length}`);
  console.log(`Intents:  ${JSON.stringify(stats.by_intent)}`);
  console.log(`Merge limpio: ${path.relative(process.cwd(), MERGED_PATH)}`);
  console.log(`Stats:        ${path.relative(process.cwd(), STATS_PATH)}`);

  if (flagged.length > 0) {
    console.log('\nCasos para revisión manual:');
    for (const f of flagged) {
      console.log(`- ${f.source}:${f.line} "${(f.input || '').slice(0, 60)}" → ${f.problems.join('; ')}`);
    }
    process.exit(1);
  }
}

main();
