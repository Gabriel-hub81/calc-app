const express = require('express');
const { parseTexto } = require('../services/gemini');
const { evaluateExpression, EvaluationError } = require('../services/evaluator');

const router = express.Router();
const MAX_INPUT_LENGTH = 500;

/**
 * POST /calculate
 * Body: { texto: string, idioma?: "es"|"en"|"pt" }
 * Tres salidas posibles: éxito / ambigüedad / error.
 * El cálculo SIEMPRE se entrega sin wallet ni blockchain de por medio —
 * la verificación on-chain es una acción opcional aparte (Sesión 2).
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

  if (parsed.tipo === 'ambiguo') {
    return res.json({
      ambiguo: true,
      mensaje: parsed.mensaje,
      opciones: parsed.opciones || [],
      idioma_detectado: parsed.idioma || 'es'
    });
  }

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
});

module.exports = router;
