/**
 * AGENTE CONTRALOR DE GASTOS
 *
 * No confundir con el vigía de precios: el vigía cuida el dinero de las
 * usuarias (qué pagan por el azúcar). El contralor cuida el dinero del negocio
 * (qué gasta CALC en sostenerlas).
 *
 * Responde la pregunta que define el precio de la suscripción: ¿cuánto cuesta
 * al mes una usuaria activa? Sin ese número, poner precio es adivinar.
 *
 * Y vigila el pico del día: la alerta de presupuesto de Google es mensual y
 * avisa cuando ya se gastó la mitad. Esto lo ve en 24 horas.
 */
const { round2 } = require('../services/ledger');
const { diaDe } = require('../services/usage');

// Costo por operación en USD. MEDIDO, no adivinado: el 16/08/2026 se corrieron
// llamadas reales de CALC leyendo `usageMetadata` de la respuesta de Gemini.
//
//   texto  → entrada 2596 tok · salida 119 · pensamiento 417
//   ticket → entrada 1099 tok · salida 797 · pensamiento 1439
//
// Tarifa de gemini-3.5-flash: $1.50 por millón de entrada, $9.00 de salida, y
// el pensamiento se cobra como salida. De ahí:
//   texto  = 2596/1e6*1.50 + (119+417)/1e6*9.00  = 0.0087
//   ticket = 1099/1e6*1.50 + (797+1439)/1e6*9.00 = 0.0218
//
// Los valores anteriores (0.0004 y 0.004) eran suposiciones y subestimaban el
// costo real 22 y 5 veces. Poner precio con esos números habría salido caro.
// Siguen siendo estimaciones —no la factura de Google— pero ya de datos reales.
const COSTO_TEXTO_USD = Number(process.env.COSTO_TEXTO_USD || 0.0087);
const COSTO_VISION_USD = Number(process.env.COSTO_VISION_USD || 0.0218);
const USD_MXN = Number(process.env.USD_MXN || 18);

// Un día que gasta más de X veces el promedio reciente merece mirarse.
const FACTOR_PICO = 3;
const DIAS_REFERENCIA = 7;
// Piso para no gritar por ruido: con centavos, cualquier día "triplica".
const PICO_MINIMO_USD = 0.5;

function costoDeUso(u) {
  return (u.texto || 0) * COSTO_TEXTO_USD + (u.vision || 0) * COSTO_VISION_USD;
}

function agregarDia(filas) {
  const usuarios = filas.filter((u) => u.uid !== 'anon');
  const anon = filas.filter((u) => u.uid === 'anon');
  const costoUsuarios = usuarios.reduce((s, u) => s + costoDeUso(u), 0);
  const costoAnon = anon.reduce((s, u) => s + costoDeUso(u), 0);
  return {
    usuarios_activos: usuarios.length,
    llamadas_texto: filas.reduce((s, u) => s + (u.texto || 0), 0),
    llamadas_vision: filas.reduce((s, u) => s + (u.vision || 0), 0),
    costo_usd: round2(costoUsuarios + costoAnon),
    costo_usuarios_usd: costoUsuarios,
    costo_anonimo_usd: costoAnon
  };
}

function fechaMenos(dias, ahora) {
  const d = new Date(ahora);
  d.setUTCDate(d.getUTCDate() - dias);
  return diaDe(d);
}

async function ejecutar({ store, ahora = new Date().toISOString() }) {
  const inicio = Date.now();
  const ayer = fechaMenos(1, ahora);

  const filasAyer = await store.getUsage(ayer);
  const dia = agregarDia(filasAyer);

  // Referencia: los días anteriores CON actividad (un día muerto no sirve
  // de base de comparación, haría que cualquier día normal parezca un pico).
  const referencias = [];
  for (let i = 2; i <= DIAS_REFERENCIA + 1; i += 1) {
    const filas = await store.getUsage(fechaMenos(i, ahora));
    if (filas.length === 0) continue;
    referencias.push(agregarDia(filas).costo_usd);
  }
  const promedioPrevio = referencias.length
    ? round2(referencias.reduce((s, c) => s + c, 0) / referencias.length)
    : null;

  // Costo por usuaria activa: el número que define si se puede cobrar 50 pesos
  const costoPorUsuarioDia = dia.usuarios_activos
    ? dia.costo_usuarios_usd / dia.usuarios_activos
    : 0;
  const costoPorUsuarioMesUsd = round2(costoPorUsuarioDia * 30);
  const costoPorUsuarioMesMxn = round2(costoPorUsuarioMesUsd * USD_MXN);

  const hayPico =
    promedioPrevio !== null &&
    dia.costo_usd > PICO_MINIMO_USD &&
    dia.costo_usd > promedioPrevio * FACTOR_PICO;

  return {
    agente: 'cost-watch',
    ejecutado_en: ahora,
    dia_medido: ayer,
    usuarios_activos: dia.usuarios_activos,
    llamadas_texto: dia.llamadas_texto,
    llamadas_vision: dia.llamadas_vision,
    costo_dia_usd: dia.costo_usd,
    promedio_previo_usd: promedioPrevio,
    dias_de_referencia: referencias.length,
    costo_por_usuario_mes_usd: costoPorUsuarioMesUsd,
    costo_por_usuario_mes_mxn: costoPorUsuarioMesMxn,
    pico: hayPico,
    veredicto: hayPico
      ? `PICO DE GASTO: ${dia.costo_usd} USD contra un promedio de ${promedioPrevio}. Revisa si hay abuso.`
      : dia.usuarios_activos === 0
        ? 'Sin actividad de usuarios registrados ayer.'
        : `Normal: ${dia.usuarios_activos} usuaria(s) activa(s), ~${costoPorUsuarioMesMxn} MXN al mes cada una.`,
    duracion_ms: Date.now() - inicio
  };
}

module.exports = { ejecutar, agregarDia, costoDeUso, FACTOR_PICO, PICO_MINIMO_USD };
