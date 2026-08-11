/**
 * AGENTE GUARDIÁN DE PRECISIÓN
 *
 * Corre solo y le hace a CALC un examen sorpresa contra Gemini real: un puñado
 * de casos con respuesta conocida, priorizando los de dinero. Si la precisión
 * se degrada —porque Google cambió el modelo, porque el prompt se rompió, o
 * porque el servicio anda mal— avisa. Es el seguro para cuando nadie está
 * mirando: que se entere la dueña, no las usuarias.
 *
 * REGLA CENTRAL: distinguir "respondió mal" de "no respondió".
 * Un error 500 de Google NO es una degradación de precisión. Confundir las dos
 * cosas produce falsas alarmas, y una falsa alarma a media madrugada durante un
 * viaje es tan dañina como no tener alarma: se aprende a ignorarla.
 */
const fs = require('fs');
const path = require('path');

const { evaluateExpression, EvaluationError } = require('../services/evaluator');

// Cuántos casos por corrida. Chico a propósito: corre todos los días y cada
// caso cuesta una llamada a Gemini. La suite completa vive en scripts/accuracy.js
const CASOS_POR_CORRIDA = 12;
// Con menos de esto respondiendo, no hay examen válido: el veredicto es
// "no pude evaluar", nunca "está degradado".
const MIN_EVALUABLES = 6;
const UMBRAL_ACIERTO_PCT = 90;

function cargarCasos(casesPath) {
  const ruta = casesPath || path.join(__dirname, '..', '..', 'tests', 'test_cases.json');
  return JSON.parse(fs.readFileSync(ruta, 'utf8'));
}

/**
 * Selecciona el examen: TODOS los casos de dinero (ahí la meta es cero errores)
 * y luego se rellena con otros, alternando para no repetir siempre los mismos.
 */
function elegirCasos(todos, limite = CASOS_POR_CORRIDA, semilla = 0) {
  const evaluables = todos.filter((c) => typeof c.expected_result === 'number');
  const dinero = evaluables.filter((c) => c.es_dinero);
  const resto = evaluables.filter((c) => !c.es_dinero);
  const rotado = resto.length ? resto.slice(semilla % resto.length).concat(resto.slice(0, semilla % resto.length)) : [];
  return [...dinero, ...rotado].slice(0, limite);
}

function aciertoNumerico(obtenido, esperado) {
  const tolerancia = Math.max(0.01, Math.abs(esperado) * 0.005);
  return Math.abs(obtenido - esperado) <= tolerancia;
}

/** Evalúa un caso. Devuelve 'ok' | 'mal' | 'sin_respuesta'. */
async function evaluarCaso(c, parseTexto) {
  let parsed;
  try {
    parsed = await parseTexto(c.input);
  } catch (err) {
    // La API no respondió (500, 503, cuota, JSON irreparable). No es un error
    // de precisión: es falta de servicio.
    return { id: c.id, estado: 'sin_respuesta', detalle: String(err.message).slice(0, 120) };
  }

  try {
    let valor;
    if (parsed.intent === 'register') {
      const items = parsed.registro?.items || [];
      if (!items.length) return { id: c.id, estado: 'mal', detalle: 'registro sin items' };
      // La suma la hace el código, igual que en producción
      valor = items.reduce(
        (s, it) => s + evaluateExpression(`${it.cantidad || 1} * ${it.precio_unitario || 0}`, true),
        0
      );
    } else {
      if (parsed.tipo !== 'ok' || !parsed.expresion) {
        return { id: c.id, estado: 'mal', detalle: `tipo ${parsed.tipo}` };
      }
      valor = evaluateExpression(parsed.expresion, Boolean(parsed.es_dinero));
    }

    const pasa = aciertoNumerico(valor, c.expected_result);
    return {
      id: c.id,
      estado: pasa ? 'ok' : 'mal',
      es_dinero: Boolean(c.es_dinero),
      esperado: c.expected_result,
      obtenido: valor
    };
  } catch (err) {
    if (err instanceof EvaluationError) {
      return { id: c.id, estado: 'mal', es_dinero: Boolean(c.es_dinero), detalle: err.message };
    }
    return { id: c.id, estado: 'sin_respuesta', detalle: String(err.message).slice(0, 120) };
  }
}

/**
 * @returns {object} veredicto de la corrida. `degradado: true` es la señal de
 * alarma; `evaluable: false` significa que no hubo examen válido.
 */
async function ejecutar({ parseTexto, casesPath, limite = CASOS_POR_CORRIDA, semilla = new Date().getUTCDate() }) {
  const inicio = Date.now();
  const casos = elegirCasos(cargarCasos(casesPath), limite, semilla);

  const resultados = [];
  for (const c of casos) {
    resultados.push(await evaluarCaso(c, parseTexto));
  }

  const evaluados = resultados.filter((r) => r.estado !== 'sin_respuesta');
  const correctos = evaluados.filter((r) => r.estado === 'ok');
  const fallos = evaluados.filter((r) => r.estado === 'mal');
  const fallosDinero = fallos.filter((r) => r.es_dinero);
  const sinRespuesta = resultados.filter((r) => r.estado === 'sin_respuesta');

  const evaluable = evaluados.length >= MIN_EVALUABLES;
  const aciertoPct = evaluados.length ? Math.round((correctos.length / evaluados.length) * 1000) / 10 : null;

  // En dinero la meta es cero: un solo fallo enciende la alarma.
  const degradado = evaluable && (fallosDinero.length > 0 || aciertoPct < UMBRAL_ACIERTO_PCT);

  return {
    agente: 'accuracy-guard',
    ejecutado_en: new Date().toISOString(),
    casos_intentados: casos.length,
    evaluados: evaluados.length,
    correctos: correctos.length,
    fallos: fallos.length,
    fallos_dinero: fallosDinero.length,
    sin_respuesta: sinRespuesta.length,
    acierto_pct: aciertoPct,
    evaluable,
    degradado,
    veredicto: !evaluable
      ? 'No pude evaluar: la API no respondió en suficientes casos. No es una degradación de precisión.'
      : degradado
        ? `PRECISIÓN DEGRADADA: ${fallos.length} fallo(s) de ${evaluados.length}${fallosDinero.length ? `, ${fallosDinero.length} en DINERO` : ''}.`
        : `Sin novedad: ${correctos.length}/${evaluados.length} correctos.`,
    detalle_fallos: fallos.map((f) => ({
      id: f.id, esperado: f.esperado, obtenido: f.obtenido, detalle: f.detalle
    })),
    duracion_ms: Date.now() - inicio
  };
}

module.exports = { ejecutar, elegirCasos, evaluarCaso, aciertoNumerico, MIN_EVALUABLES, UMBRAL_ACIERTO_PCT };
