const { evaluateExpression, EvaluationError } = require('./evaluator');

/**
 * Comparación por unidad: "¿cuál me conviene, la bolsa de 2 kg a $245 o la de
 * 6.81 kg a $1050?".
 *
 * TODA la aritmética vive aquí (mathjs vía evaluator) — Gemini solo extrae las
 * opciones. La conversión de unidades también es aritmética, así que también se
 * hace en código: el modelo reporta cantidad y unidad tal como vienen en el
 * empaque y aquí se normalizan.
 */

// Unidades equivalentes → [unidad base, factor]. Solo conversiones exactas.
const UNIDADES = {
  g: ['kg', 0.001], gr: ['kg', 0.001], gramo: ['kg', 0.001], gramos: ['kg', 0.001],
  kg: ['kg', 1], kilo: ['kg', 1], kilos: ['kg', 1], kilogramo: ['kg', 1], kilogramos: ['kg', 1],
  ml: ['l', 0.001], mililitro: ['l', 0.001], mililitros: ['l', 0.001],
  l: ['l', 1], lt: ['l', 1], litro: ['l', 1], litros: ['l', 1],
  oz: ['oz', 1], lb: ['lb', 1], libra: ['lb', 1], libras: ['lb', 1],
  pieza: ['pieza', 1], piezas: ['pieza', 1], pza: ['pieza', 1], unidad: ['pieza', 1],
  unidades: ['pieza', 1], rollo: ['rollo', 1], rollos: ['rollo', 1]
};

function normalizarUnidad(unidad) {
  const clave = String(unidad || 'pieza').toLowerCase().trim();
  return UNIDADES[clave] || [clave, 1];
}

class ComparacionError extends Error {
  constructor(message, sugerencia) {
    super(message);
    this.name = 'ComparacionError';
    this.sugerencia = sugerencia;
  }
}

const TEXTOS = {
  es: {
    mejor: (etiqueta, precio, unidad) =>
      `Te conviene ${etiqueta}: sale a ${precio} por ${unidad}.`,
    ahorro: (monto, unidad, pct) => `Ahorras ${monto} por ${unidad} (${pct}% más barata).`,
    empate: 'Las dos opciones cuestan lo mismo por unidad: llévate la que prefieras.',
    unidades: 'Para comparar necesito que las opciones estén en la misma unidad (kilos con kilos, litros con litros).',
    faltan: 'Necesito al menos dos opciones con su precio y su contenido.'
  },
  en: {
    mejor: (etiqueta, precio, unidad) => `Go with ${etiqueta}: it works out to ${precio} per ${unidad}.`,
    ahorro: (monto, unidad, pct) => `You save ${monto} per ${unidad} (${pct}% cheaper).`,
    empate: 'Both options cost the same per unit: take whichever you prefer.',
    unidades: 'To compare I need the options in the same unit (kilos with kilos, liters with liters).',
    faltan: 'I need at least two options with their price and their content.'
  }
};

function money(n) {
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * @param {Array} opciones - [{ etiqueta, precio, cantidad, unidad }]
 * @param {string} idioma
 * @returns {object} respuesta lista para el cliente
 */
function compararOpciones(opciones, idioma = 'es') {
  const t = TEXTOS[idioma] || TEXTOS.es;

  if (!Array.isArray(opciones) || opciones.length < 2) {
    throw new ComparacionError(t.faltan);
  }

  const evaluadas = opciones.map((op) => {
    const precio = Number(op.precio);
    const cantidad = Number(op.cantidad);
    if (!Number.isFinite(precio) || !Number.isFinite(cantidad) || cantidad <= 0) {
      throw new ComparacionError(t.faltan);
    }
    const [base, factor] = normalizarUnidad(op.unidad);
    // La conversión y la división las hace mathjs, nunca el modelo
    const cantidadBase = evaluateExpression(`${cantidad} * ${factor}`, false);
    const precioUnitario = evaluateExpression(`${precio} / ${cantidadBase}`, true);
    return {
      etiqueta: String(op.etiqueta || '').trim() || `${cantidad} ${op.unidad || ''}`.trim(),
      precio,
      cantidad,
      unidad: op.unidad || base,
      unidad_base: base,
      precio_unitario: precioUnitario
    };
  });

  // Comparar peras con peras: si las unidades base no coinciden, no se compara
  const bases = new Set(evaluadas.map((e) => e.unidad_base));
  if (bases.size > 1) throw new ComparacionError(t.unidades);

  const ordenadas = [...evaluadas].sort((a, b) => a.precio_unitario - b.precio_unitario);
  const mejor = ordenadas[0];
  const peor = ordenadas[ordenadas.length - 1];
  const unidad = mejor.unidad_base;

  if (mejor.precio_unitario === peor.precio_unitario) {
    return {
      comparacion: true,
      opciones: evaluadas,
      mejor: mejor.etiqueta,
      mensaje: t.empate,
      idioma_detectado: idioma
    };
  }

  const ahorro = evaluateExpression(`${peor.precio_unitario} - ${mejor.precio_unitario}`, true);
  // Porcentaje respecto a la opción CARA: "21% más barata" es lo que se ahorra
  const ahorroPct = evaluateExpression(`(${ahorro} / ${peor.precio_unitario}) * 100`, false);

  return {
    comparacion: true,
    opciones: evaluadas,
    mejor: mejor.etiqueta,
    ahorro_por_unidad: ahorro,
    ahorro_pct: Math.round(ahorroPct * 10) / 10,
    unidad,
    mensaje: `${t.mejor(mejor.etiqueta, money(mejor.precio_unitario), unidad)} ${t.ahorro(
      money(ahorro),
      unidad,
      Math.round(ahorroPct)
    )}`,
    idioma_detectado: idioma
  };
}

module.exports = { compararOpciones, ComparacionError, normalizarUnidad };
