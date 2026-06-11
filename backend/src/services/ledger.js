/**
 * Ledger: construcción de entries y resúmenes.
 * REGLA NO-NEGOCIABLE: todos los totales, ganancias y márgenes se calculan
 * aquí, en código. Gemini solo estructura (extrae items); nunca hace aritmética.
 */
class LedgerError extends Error {
  constructor(message, sugerencia) {
    super(message);
    this.name = 'LedgerError';
    this.sugerencia = sugerencia;
  }
}

const TIPO_MAP = { venta: 'sale', compra: 'purchase', gasto: 'expense' };
const TIPO_LABEL = { sale: 'venta', purchase: 'compra', expense: 'gasto' };

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const round1 = (n) => Math.round((n + Number.EPSILON) * 10) / 10;
const money = (n) => `$${round2(n).toFixed(2)}`;

function slugify(name) {
  return String(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function isPositiveNumber(n) {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

/**
 * Construye un entry a partir del registro estructurado por Gemini.
 * @param {object} registro - { tipo: venta|compra|gasto, items[], moneda }
 */
function buildEntry(registro, { source = 'text', description = '' } = {}) {
  if (!registro || !TIPO_MAP[registro.tipo]) {
    throw new LedgerError(
      'No entendí qué quieres anotar.',
      "Dime si es una venta, una compra o un gasto. Ejemplo: 'vendí 10 chocolates a 10 pesos'"
    );
  }
  const rawItems = Array.isArray(registro.items) ? registro.items : [];
  if (rawItems.length === 0) {
    throw new LedgerError(
      'No encontré qué anotar en tu mensaje.',
      "Dime qué y a cuánto. Ejemplo: 'compré 3 cajas de malvaviscos a 5 pesos'"
    );
  }

  const items = rawItems.map((it) => {
    const nombre = String(it.nombre || '').trim();
    const qty = it.cantidad !== undefined ? it.cantidad : 1;
    if (!nombre) {
      throw new LedgerError('Me faltó el nombre de uno de los artículos.');
    }
    if (!isPositiveNumber(qty)) {
      throw new LedgerError(`No entendí la cantidad de "${nombre}".`);
    }
    if (typeof it.precio_unitario !== 'number' || !Number.isFinite(it.precio_unitario) || it.precio_unitario < 0) {
      throw new LedgerError(
        `Me falta el precio de "${nombre}".`,
        `Ejemplo: '${nombre} a 10 pesos'`
      );
    }
    const item = {
      name_raw: nombre,
      name_canonical: String(it.nombre_canonico || nombre).toLowerCase().trim(),
      qty,
      unit_price: round2(it.precio_unitario),
      total: round2(qty * it.precio_unitario)
    };
    if (typeof it.costo_unitario === 'number' && Number.isFinite(it.costo_unitario) && it.costo_unitario >= 0) {
      item.unit_cost = round2(it.costo_unitario);
    }
    return item;
  });

  const entry = {
    type: TIPO_MAP[registro.tipo],
    description,
    items,
    amount_total: round2(items.reduce((s, it) => s + it.total, 0)),
    source,
    currency: registro.moneda || 'MXN',
    created_at: new Date().toISOString()
  };

  if (entry.type === 'sale') {
    const withCost = items.filter((it) => it.unit_cost !== undefined);
    if (withCost.length > 0) {
      entry.ganancia = round2(
        withCost.reduce((s, it) => s + it.qty * (it.unit_price - it.unit_cost), 0)
      );
      if (entry.amount_total > 0) {
        entry.margen_pct = round1((entry.ganancia / entry.amount_total) * 100);
      }
    }
  }

  return entry;
}

/** Descripción en lenguaje natural de lo anotado (los números ya vienen calculados). */
function describeEntry(entry) {
  const itemsTxt = entry.items
    .slice(0, 3)
    .map((it) => `${it.qty} ${it.name_raw} a ${money(it.unit_price)}`)
    .join(', ');
  const extra = entry.items.length > 3 ? ` y ${entry.items.length - 3} más` : '';
  let msg = `Anotado: ${itemsTxt}${extra} → ${TIPO_LABEL[entry.type]} de ${money(entry.amount_total)}.`;
  if (entry.ganancia !== undefined) {
    msg += ` Ganancia ${money(entry.ganancia)}`;
    if (entry.margen_pct !== undefined) msg += ` (margen ${entry.margen_pct}%)`;
    msg += '.';
  }
  return msg;
}

/** Rango de fechas para un periodo. */
function rangeFor(periodo = 'hoy') {
  const now = new Date();
  const start = new Date(now);
  if (periodo === 'semana') {
    start.setDate(start.getDate() - 7);
  } else if (periodo === 'mes') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setHours(0, 0, 0, 0); // hoy
  }
  return { from: start.toISOString(), to: now.toISOString() };
}

const PERIODO_LABEL = { hoy: 'Hoy', semana: 'Esta semana', mes: 'Este mes' };

/** Resumen de un conjunto de entries — toda la suma ocurre aquí, en código. */
function summarize(entries, periodo = 'hoy') {
  const ventas = entries.filter((e) => e.type === 'sale');
  const salidas = entries.filter((e) => e.type === 'expense' || e.type === 'purchase');

  const totalVentas = round2(ventas.reduce((s, e) => s + e.amount_total, 0));
  const totalGastos = round2(salidas.reduce((s, e) => s + e.amount_total, 0));
  const gananciaVentas = round2(
    ventas.reduce((s, e) => s + (e.ganancia !== undefined ? e.ganancia : 0), 0)
  );
  const balance = round2(totalVentas - totalGastos);

  const label = PERIODO_LABEL[periodo] || 'En este periodo';
  let mensaje;
  if (entries.length === 0) {
    mensaje = `${label} no tienes movimientos anotados todavía.`;
  } else {
    const partes = [];
    if (ventas.length > 0) {
      let v = `${money(totalVentas)} en ventas`;
      if (gananciaVentas > 0) v += ` (ganancia ${money(gananciaVentas)})`;
      partes.push(v);
    }
    if (salidas.length > 0) partes.push(`${money(totalGastos)} en gastos`);
    mensaje = `${label} llevas ${partes.join(' y ')}.`;
    if (ventas.length > 0 && salidas.length > 0) {
      mensaje += ` Balance: ${balance >= 0 ? '+' : ''}${money(balance)}.`;
    }
  }

  return {
    periodo,
    ventas: totalVentas,
    gastos: totalGastos,
    ganancia_ventas: gananciaVentas,
    balance,
    movimientos: entries.length,
    mensaje
  };
}

module.exports = {
  buildEntry,
  describeEntry,
  summarize,
  rangeFor,
  slugify,
  round1,
  round2,
  money,
  LedgerError
};
