/**
 * Helper de precios v0: comparación contra el historial DEL PROPIO usuario.
 * Fuera de alcance (Fase 2): comparación agregada entre usuarios.
 */
const { slugify, round1, round2, money } = require('./ledger');

const UMBRAL_ALERTA_PCT = 10;

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Puntos de precio a guardar a partir de un entry de compra/gasto. */
function pricePointsFromEntry(entry, entryId) {
  if (entry.type !== 'purchase' && entry.type !== 'expense') return [];
  return entry.items
    .filter((it) => it.unit_price > 0 && it.name_canonical)
    .map((it) => ({
      product_id: slugify(it.name_canonical),
      name_canonical: it.name_canonical,
      unit_price: it.unit_price,
      date: entry.created_at,
      entry_id: entryId
    }));
}

/**
 * Alertas de precio para los items de una compra, comparando contra el
 * promedio de las últimas 3 compras del mismo producto.
 * IMPORTANTE: llamar ANTES de guardar los puntos nuevos, para no contaminar
 * el promedio con la compra actual.
 */
async function alertsForItems(store, uid, items) {
  const alerts = [];
  for (const it of items) {
    if (!(it.unit_price > 0) || !it.name_canonical) continue;
    const hist = await store.getPriceHistory(uid, slugify(it.name_canonical));
    const previas = (hist?.purchases || []).slice(-3);
    if (previas.length === 0) continue;
    const promedio = previas.reduce((s, p) => s + p.unit_price, 0) / previas.length;
    const pct = (it.unit_price / promedio - 1) * 100;
    if (pct > UMBRAL_ALERTA_PCT) {
      alerts.push({
        producto: hist.name_canonical,
        precio_actual: round2(it.unit_price),
        precio_promedio: round2(promedio),
        diferencia_pct: round1(pct),
        mensaje: `${cap(hist.name_canonical)}: lo pagaste ${round1(pct)}% más caro que tu promedio reciente (${money(promedio)} → ${money(it.unit_price)}).`
      });
    }
  }
  return alerts;
}

/**
 * Resumen "¿qué estoy comprando más caro?": por producto con 2+ compras,
 * última compra vs promedio de las anteriores (hasta 3), ordenado por subida.
 */
async function priceSummary(store, uid, limit = 10) {
  const histories = await store.getAllPriceHistories(uid);
  const subidas = [];
  for (const h of histories) {
    const compras = [...(h.purchases || [])].sort((a, b) => a.date.localeCompare(b.date));
    if (compras.length < 2) continue;
    const ultima = compras[compras.length - 1];
    const previas = compras.slice(0, -1).slice(-3);
    const promedio = previas.reduce((s, p) => s + p.unit_price, 0) / previas.length;
    const pct = (ultima.unit_price / promedio - 1) * 100;
    if (pct <= 0) continue;
    subidas.push({
      producto: h.name_canonical,
      precio_ultimo: round2(ultima.unit_price),
      promedio_anterior: round2(promedio),
      diferencia_pct: round1(pct),
      mensaje: `${cap(h.name_canonical)}: ${money(promedio)} → ${money(ultima.unit_price)} (+${round1(pct)}%)`
    });
  }
  subidas.sort((a, b) => b.diferencia_pct - a.diferencia_pct);
  const top = subidas.slice(0, limit);
  return {
    productos: top,
    mensaje:
      top.length === 0
        ? 'No veo productos que estés comprando más caro que antes. 👍'
        : `Estás pagando más caro en ${top.length} producto${top.length > 1 ? 's' : ''} que antes.`
  };
}

module.exports = { pricePointsFromEntry, alertsForItems, priceSummary, UMBRAL_ALERTA_PCT };
