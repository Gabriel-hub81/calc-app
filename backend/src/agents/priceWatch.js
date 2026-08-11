/**
 * AGENTE VIGÍA DE PRECIOS
 *
 * Corre solo, todos los días, sin que nadie lo pida. Revisa el historial de
 * cada usuario y decide si hay algo que valga la pena avisar ANTES de la
 * próxima compra — no después de pagar, cuando el aviso ya no sirve.
 *
 * REGLAS DE DISEÑO (aprendidas discutiendo con Hazel):
 *
 * 1. INFORMA, NO ORDENA. "El azúcar subió 18%, considéralo antes de comprar",
 *    nunca "no la compres". CALC no sabe si esa persona necesita azúcar hoy.
 *    Un agente que da órdenes cuando puede equivocarse destruye la confianza.
 * 2. NO GRITA. Solo avisa si la subida supera el umbral Y el impacto en pesos
 *    vale la pena. Un vigía que avisa todos los días se ignora en una semana.
 * 3. NO REPITE. Si ya avisó de un producto hace poco, se calla.
 * 4. LA ARITMÉTICA ES DEL CÓDIGO. Gemini elige qué vale la pena decir y cómo
 *    decirlo; los números salen de mathjs y son los que se guardan. Si el
 *    modelo falla, hay un mensaje de respaldo y el aviso sale igual.
 */
const { round1, round2, money } = require('../services/ledger');

const UMBRAL_PCT = 12; // subida mínima para molestar a alguien
const UMBRAL_PESOS = 3; // y que además signifique algo en dinero
const DIAS_SILENCIO = 7; // no repetir el mismo producto antes de esto
const MIN_COMPRAS_PREVIAS = 2; // con una sola compra no hay tendencia

function cap(s) {
  return String(s).charAt(0).toUpperCase() + String(s).slice(1);
}

function diasEntre(isoA, isoB) {
  return Math.abs(new Date(isoA) - new Date(isoB)) / 86400000;
}

/**
 * Encuentra subidas dignas de aviso en el historial de un usuario.
 * Solo lectura y aritmética — sin efectos secundarios, fácil de probar.
 */
function detectarSubidas(histories, avisosPrevios = [], ahora = new Date().toISOString()) {
  const candidatos = [];

  for (const h of histories) {
    const compras = [...(h.purchases || [])]
      .filter((p) => p && p.unit_price > 0 && p.date)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    if (compras.length < MIN_COMPRAS_PREVIAS + 1) continue;

    const ultima = compras[compras.length - 1];
    const previas = compras.slice(0, -1).slice(-3);
    const promedio = previas.reduce((s, p) => s + p.unit_price, 0) / previas.length;
    if (!(promedio > 0)) continue;

    const pct = (ultima.unit_price / promedio - 1) * 100;
    const pesos = ultima.unit_price - promedio;
    if (pct < UMBRAL_PCT || pesos < UMBRAL_PESOS) continue;

    // ¿ya le avisamos de esto hace poco?
    const yaAvisado = avisosPrevios.some(
      (a) =>
        a.producto === h.name_canonical &&
        a.created_at &&
        diasEntre(a.created_at, ahora) < DIAS_SILENCIO
    );
    if (yaAvisado) continue;

    candidatos.push({
      producto: h.name_canonical,
      precio_ultimo: round2(ultima.unit_price),
      promedio_anterior: round2(promedio),
      diferencia_pct: round1(pct),
      diferencia_pesos: round2(pesos),
      compras_consideradas: previas.length
    });
  }

  // el que más pega en el bolsillo primero
  candidatos.sort((a, b) => b.diferencia_pesos - a.diferencia_pesos);
  return candidatos;
}

/** Mensaje de respaldo: se usa tal cual si Gemini no está disponible. */
function mensajeBase(c, idioma = 'es') {
  if (idioma === 'en') {
    return `${cap(c.producto)} went up ${c.diferencia_pct}% (${money(
      c.promedio_anterior
    )} → ${money(c.precio_ultimo)}). Keep it in mind before buying.`;
  }
  return `${cap(c.producto)} subió ${c.diferencia_pct}% (${money(c.promedio_anterior)} → ${money(
    c.precio_ultimo
  )}). Considéralo antes de comprar.`;
}

/**
 * Redacta el aviso con Gemini a partir de números YA calculados. El modelo
 * solo elige palabras: tiene prohibido calcular y se le prohíbe ordenar.
 * Si algo sale mal, devuelve el mensaje base — el aviso nunca se pierde.
 */
async function redactar(c, idioma, deps) {
  if (!deps || !deps.generarTexto) return mensajeBase(c, idioma);
  const base = mensajeBase(c, idioma);
  try {
    const texto = await deps.generarTexto(
      `Eres CALC, un copiloto financiero para personas de la economía informal en México. ` +
        `Escribe UN aviso corto (máximo 20 palabras), cálido y en ${idioma === 'en' ? 'inglés' : 'español'} sencillo. ` +
        `REGLAS: usa EXACTAMENTE estos números, no calcules ni inventes ninguno; ` +
        `informa, NUNCA des una orden ni digas que no compre algo (la persona decide); ` +
        `sin emojis, sin comillas, una sola frase.\n` +
        `Producto: ${c.producto}. Antes pagaba ${money(c.promedio_anterior)}. ` +
        `Ahora ${money(c.precio_ultimo)}. Subió ${c.diferencia_pct}%.`
    );
    const limpio = String(texto || '').trim().replace(/^["']|["']$/g, '');
    // Guardas: si el modelo se pasa de largo o se pone mandón, mandamos el base
    const mandon = /\bno (lo |la |las |los )?(compres|compre)\b|\bdon'?t buy\b/i.test(limpio);
    if (!limpio || limpio.length > 200 || mandon) return base;
    return limpio;
  } catch {
    return base;
  }
}

/**
 * Ejecuta el agente sobre todos los usuarios.
 * @returns {object} resumen de la corrida (queda en los logs del job)
 */
async function ejecutar({ store, generarTexto, ahora = new Date().toISOString(), maxPorUsuario = 3 }) {
  const inicio = Date.now();
  const uids = await store.listUserIds();
  const resumen = {
    agente: 'price-watch',
    ejecutado_en: ahora,
    usuarios_revisados: uids.length,
    usuarios_con_aviso: 0,
    avisos_creados: 0,
    errores: 0,
    detalle: []
  };

  for (const uid of uids) {
    try {
      const [histories, avisosPrevios] = await Promise.all([
        store.getAllPriceHistories(uid),
        store.getNotices(uid).catch(() => [])
      ]);

      const candidatos = detectarSubidas(histories, avisosPrevios, ahora).slice(0, maxPorUsuario);
      if (candidatos.length === 0) continue;

      for (const c of candidatos) {
        const mensaje = await redactar(c, 'es', { generarTexto });
        await store.addNotice(uid, {
          tipo: 'precio_subio',
          agente: 'price-watch',
          producto: c.producto,
          precio_ultimo: c.precio_ultimo,
          promedio_anterior: c.promedio_anterior,
          diferencia_pct: c.diferencia_pct,
          diferencia_pesos: c.diferencia_pesos,
          mensaje,
          leido: false,
          created_at: ahora
        });
        resumen.avisos_creados += 1;
      }
      resumen.usuarios_con_aviso += 1;
      resumen.detalle.push({ uid_hash: uid.slice(-6), avisos: candidatos.length });
    } catch (err) {
      resumen.errores += 1;
      console.error(`[price-watch] usuario falló: ${err.message}`);
    }
  }

  resumen.duracion_ms = Date.now() - inicio;
  return resumen;
}

module.exports = {
  ejecutar,
  detectarSubidas,
  mensajeBase,
  redactar,
  UMBRAL_PCT,
  UMBRAL_PESOS,
  DIAS_SILENCIO
};
