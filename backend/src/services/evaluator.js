const { create, all } = require('mathjs');

const math = create(all, {});

// Solo dígitos, operadores aritméticos, paréntesis, punto decimal y espacios.
// Esto bloquea letras por completo: sin nombres no hay funciones ni variables
// que invocar en mathjs. El símbolo % NO se permite: Gemini debe convertir
// porcentajes a decimales (en mathjs % es módulo y en contexto de dinero eso
// sería un error silencioso).
const SAFE_EXPRESSION = /^[\d\s+\-*/().]+$/;
const MAX_EXPRESSION_LENGTH = 200;

class EvaluationError extends Error {
  constructor(message, sugerencia) {
    super(message);
    this.name = 'EvaluationError';
    this.sugerencia = sugerencia;
  }
}

/**
 * Evalúa una expresión aritmética ya parseada por Gemini.
 * El LLM nunca hace la aritmética — eso pasa aquí, con mathjs. No-negociable.
 *
 * @param {string} expresion - p. ej. "0.15 * 800"
 * @param {boolean} esDinero - redondeo a 2 decimales si es dinero, 3 si no
 * @returns {number}
 */
function evaluateExpression(expresion, esDinero = false) {
  if (typeof expresion !== 'string' || expresion.trim().length === 0) {
    throw new EvaluationError('No recibí una operación para calcular.');
  }
  if (expresion.length > MAX_EXPRESSION_LENGTH) {
    throw new EvaluationError('La operación es demasiado larga.');
  }
  if (!SAFE_EXPRESSION.test(expresion)) {
    throw new EvaluationError(
      'La operación contiene símbolos que no puedo evaluar.',
      'Solo puedo calcular operaciones aritméticas: suma, resta, multiplicación y división.'
    );
  }

  let valor;
  try {
    valor = math.parse(expresion).compile().evaluate({});
  } catch (err) {
    throw new EvaluationError(
      'No pude calcular esa operación.',
      '¿La puedes escribir de otra forma? Ejemplo: "250 * 3"'
    );
  }

  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    throw new EvaluationError(
      'Esa operación no tiene un resultado válido (¿división entre cero?).',
      'Revisa que no estés dividiendo entre cero.'
    );
  }

  const decimales = esDinero ? 2 : 3;
  return roundTo(valor, decimales);
}

function roundTo(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

module.exports = { evaluateExpression, EvaluationError, SAFE_EXPRESSION };
