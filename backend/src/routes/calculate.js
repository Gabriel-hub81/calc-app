const express = require('express');
const { parseTexto } = require('../services/gemini');
const { evaluateExpression, EvaluationError } = require('../services/evaluator');
const { getStore } = require('../services/store');
const { buildEntry, describeEntry, summarize, rangeFor, LedgerError } = require('../services/ledger');
const { pricePointsFromEntry, alertsForItems } = require('../services/priceHelper');

const router = express.Router();
const MAX_INPUT_LENGTH = 500;

const AMBIGUO = (parsed) => ({
  ambiguo: true,
  mensaje: parsed.mensaje,
  opciones: parsed.opciones || [],
  idioma_detectado: parsed.idioma || 'es'
});

const REQUIERE_LOGIN = {
  requiere_login: true,
  mensaje: 'Para guardar tu día, entra con tu correo o teléfono.'
};

/**
 * POST /calculate
 * Body: { texto: string, idioma?: "es"|"en"|"pt" }
 *
 * Gemini clasifica el intent del texto:
 * - calc     → cálculo puro (sin auth; el cálculo SIEMPRE se entrega)
 * - register → anota venta/compra/gasto (requiere auth)
 * - query    → "¿cómo voy hoy?" (requiere auth)
 *
 * Toda la aritmética (resultados, totales, márgenes) la hace el código —
 * Gemini solo estructura.
 */
router.post('/', async (req, res) => {
  const { texto, idioma } = req.body || {};

  if (typeof texto !== 'string' || texto.trim().length === 0) {
    return res.status(400).json({
      error: true,
      mensaje: 'Necesito un texto con la operación que quieres calcular.',
      sugerencia: "Ejemplo: { \"texto\": \"cuánto es 250 por 3\" }"
    });
  }
  if (texto.length > MAX_INPUT_LENGTH) {
    return res.status(400).json({
      error: true,
      mensaje: 'El mensaje es demasiado largo.',
      sugerencia: `Máximo ${MAX_INPUT_LENGTH} caracteres.`
    });
  }
  if (idioma !== undefined && !['es', 'en', 'pt'].includes(idioma)) {
    return res.status(400).json({
      error: true,
      mensaje: "El campo 'idioma' debe ser 'es', 'en' o 'pt'."
    });
  }

  let parsed;
  try {
    parsed = await parseTexto(texto.trim(), idioma);
  } catch (err) {
    console.error('[gemini] fallo de parseo:', err.message);
    return res.status(502).json({
      error: true,
      mensaje: 'No pude procesar tu mensaje en este momento. Intenta de nuevo.',
      sugerencia: 'Si el problema sigue, espera un momento y vuelve a intentar.'
    });
  }

  const intent = parsed.intent || 'calc';

  if (intent === 'register') return handleRegister(req, res, parsed, texto.trim());
  if (intent === 'query') return handleQuery(req, res, parsed);
  return handleCalc(req, res, parsed);
});

function handleCalc(_req, res, parsed) {
  if (parsed.tipo === 'ambiguo') return res.json(AMBIGUO(parsed));

  if (parsed.tipo === 'error') {
    return res.json({
      error: true,
      mensaje: parsed.mensaje,
      sugerencia: parsed.sugerencia || "Ejemplo: 'cuánto es 250 por 3'",
      idioma_detectado: parsed.idioma || 'es'
    });
  }

  // tipo === 'ok' → la aritmética la hace el evaluador, nunca el LLM
  try {
    const resultado = evaluateExpression(parsed.expresion, Boolean(parsed.es_dinero));
    return res.json({
      resultado,
      expresion_parseada: parsed.expresion,
      idioma_detectado: parsed.idioma || 'es',
      confianza: parsed.confianza || 'media',
      correcciones: parsed.correcciones || {},
      es_dinero: Boolean(parsed.es_dinero)
    });
  } catch (err) {
    if (err instanceof EvaluationError) {
      return res.json({
        error: true,
        mensaje: err.message,
        sugerencia: err.sugerencia || "¿Lo puedes escribir de otra forma? Ejemplo: '250 * 3'",
        idioma_detectado: parsed.idioma || 'es'
      });
    }
    console.error('[evaluator] error inesperado:', err);
    return res.status(500).json({
      error: true,
      mensaje: 'Algo salió mal al calcular. Intenta de nuevo.'
    });
  }
}

async function handleRegister(req, res, parsed, textoOriginal) {
  if (parsed.tipo === 'ambiguo') return res.json(AMBIGUO(parsed));
  if (!req.uid) return res.status(401).json(REQUIERE_LOGIN);

  let entry;
  try {
    entry = buildEntry(parsed.registro, { source: 'text', description: textoOriginal });
  } catch (err) {
    if (err instanceof LedgerError) {
      return res.status(400).json({ error: true, mensaje: err.message, sugerencia: err.sugerencia });
    }
    throw err;
  }

  const store = getStore();
  try {
    // Alertas de precio ANTES de guardar los puntos nuevos (no contaminar el promedio)
    const alertas =
      entry.type === 'purchase' || entry.type === 'expense'
        ? await alertsForItems(store, req.uid, entry.items)
        : [];

    const entryId = await store.addEntry(req.uid, entry);
    const points = pricePointsFromEntry(entry, entryId);
    if (points.length > 0) await store.addPricePoints(req.uid, points);

    const hoy = await store.getEntries(req.uid, rangeFor('hoy'));
    return res.json({
      registrado: true,
      tipo: parsed.registro.tipo,
      mensaje: describeEntry(entry),
      entry: { id: entryId, ...entry },
      alertas_precio: alertas,
      resumen_dia: summarize(hoy, 'hoy')
    });
  } catch (err) {
    console.error('[store] fallo al registrar:', err.message);
    return res.status(500).json({
      error: true,
      mensaje: 'No pude guardar tu registro. Intenta de nuevo en un momento.'
    });
  }
}

async function handleQuery(req, res, parsed) {
  if (!req.uid) return res.status(401).json(REQUIERE_LOGIN);

  const periodo = ['hoy', 'semana', 'mes'].includes(parsed.consulta?.periodo)
    ? parsed.consulta.periodo
    : 'hoy';

  try {
    const entries = await getStore().getEntries(req.uid, rangeFor(periodo));
    return res.json({ consulta: true, ...summarize(entries, periodo) });
  } catch (err) {
    console.error('[store] fallo en consulta:', err.message);
    return res.status(500).json({
      error: true,
      mensaje: 'No pude consultar tus movimientos. Intenta de nuevo en un momento.'
    });
  }
}

module.exports = router;
