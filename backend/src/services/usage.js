/**
 * Registro de uso: cuántas llamadas caras (Gemini) hace cada persona al día.
 *
 * Existe para responder la pregunta que define el precio de la suscripción:
 * ¿cuánto cuesta sostener a una usuaria al mes? Sin ese número no se puede
 * poner precio, solo adivinarlo.
 *
 * NUNCA debe estorbar al usuario: si el contador falla, el cálculo sigue.
 */
const { getStore } = require('./store');

/** Día en UTC (YYYY-MM-DD): la clave del contador. */
function diaDe(fecha = new Date()) {
  return fecha.toISOString().slice(0, 10);
}

/**
 * @param {string|undefined} uid - sin sesión se agrupa en "anon"
 * @param {'texto'|'vision'} tipo
 */
function registrar(uid, tipo) {
  try {
    const store = getStore();
    if (!store.recordUsage) return;
    // Sin await a propósito: contar no puede retrasar una respuesta al usuario
    Promise.resolve(store.recordUsage(uid || 'anon', tipo, diaDe())).catch((err) =>
      console.warn(`[usage] no se pudo contar ${tipo}: ${err.message}`)
    );
  } catch (err) {
    console.warn(`[usage] no se pudo contar ${tipo}: ${err.message}`);
  }
}

module.exports = { registrar, diaDe };
