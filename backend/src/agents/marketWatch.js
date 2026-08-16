/**
 * AGENTE RADAR DE LA CENTRAL DE ABASTO
 *
 * El vigía de precios (price-watch) solo sabe lo que la usuaria ya compró: no
 * puede decir nada hasta que alguien capture tickets durante semanas. Los logs
 * de producción lo dicen sin adornos — `avisos_creados=0` día tras día.
 *
 * Este agente resuelve ese arranque en frío. Todas las mañanas consulta SNIIM
 * (Secretaría de Economía) para ~28 productos de alto consumo en una central
 * de abasto, guarda el resumen en caché y, si encuentra UNA oportunidad de
 * verdad, deja un aviso. Sirve el día uno, sin historial de nadie.
 *
 * REGLAS (heredadas del vigía, más una propia de este dato):
 *
 * 1. ES MAYOREO, NO EL SÚPER. El aviso SIEMPRE nombra la central y siempre
 *    aclara que es precio de central. Prometer un precio de tienda con datos
 *    de mayoreo es mentir, y una sola mentira comprobable tira la confianza.
 * 2. NO GRITA. Un aviso al día como máximo, y solo si la baja es grande.
 *    Silencio es la respuesta correcta la mayoría de los días.
 * 3. NO REPITE. El mismo producto no vuelve a salir en una semana.
 * 4. LA ARITMÉTICA ES DEL CÓDIGO. Gemini solo escoge palabras.
 * 5. SOLO OPORTUNIDADES. Las subidas de mayoreo tardan días en llegar a la
 *    tienda de la esquina: avisar "subió en la central" no le sirve a quien
 *    compra al menudeo. Que algo esté barato HOY en la central sí es
 *    accionable para quien surte, y para quien compra es temporada.
 */
const { money } = require('../services/ledger');
const { consultar, resumir } = require('../services/sniim');
const { PRODUCTOS, MERCADO_DEFAULT, nombreMercado } = require('../data/sniimProductos');

// Ventana de consulta: cinco semanas. Da una semana "actual" y cuatro de
// referencia, aun descontando domingos y días sin registro.
const DIAS_VENTANA = 35;
// Más exigente que el vigía personal (15%): una baja de mayoreo tiene que ser
// grande para que valga la pena mover a alguien a surtirse.
const UMBRAL_BAJA_PCT = 15;
const DIAS_SILENCIO = 7;
// Pausa entre consultas. 28 peticiones seguidas a un sitio de gobierno sin
// respirar es de mal vecino, y además invita a que nos corten.
const PAUSA_MS = Number(process.env.SNIIM_PAUSA_MS || 700);

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function cap(s) {
  return String(s).charAt(0).toUpperCase() + String(s).slice(1);
}

function diasEntre(isoA, isoB) {
  return Math.abs(new Date(isoA) - new Date(isoB)) / 86400000;
}

function restarDias(fecha, dias) {
  return new Date(new Date(fecha).getTime() - dias * 86400000);
}

/**
 * Consulta SNIIM producto por producto y arma la foto del día.
 * Un producto que falla no tumba la corrida: se cuenta y se sigue.
 */
async function recolectar({
  mercadoId = MERCADO_DEFAULT,
  ahora = new Date().toISOString(),
  productos = PRODUCTOS,
  fetchImpl,
  pausaMs = PAUSA_MS
} = {}) {
  const hasta = new Date(ahora);
  const desde = restarDias(hasta, DIAS_VENTANA);
  const resultados = [];
  const fallos = [];

  for (const p of productos) {
    try {
      const renglones = await consultar({
        productoId: p.sniim_id,
        mercadoId,
        desde,
        hasta,
        ...(fetchImpl ? { fetchImpl } : {})
      });
      const r = resumir(renglones);
      // resumir() devuelve null cuando no hay días suficientes para comparar.
      // Callarse es correcto: un porcentaje sacado de tres días es ruido.
      if (r)
        resultados.push({
          clave: p.clave,
          articulo: p.articulo || 'el',
          sniim_nombre: p.sniim_nombre,
          ...r
        });
    } catch (err) {
      fallos.push({ clave: p.clave, error: err.message });
    }
    if (pausaMs > 0) await dormir(pausaMs);
  }

  return {
    mercado_id: String(mercadoId),
    mercado_nombre: nombreMercado(mercadoId),
    fecha: String(ahora).slice(0, 10),
    actualizado_en: ahora,
    productos: resultados,
    fallos
  };
}

/**
 * La mejor oportunidad del día: la baja más grande que supere el umbral.
 * Devuelve null si no hay ninguna — que es lo que pasa casi todos los días.
 */
function mejorOportunidad(productos = [], { umbral = UMBRAL_BAJA_PCT } = {}) {
  const bajas = productos.filter((p) => p.variacion_pct <= -umbral && p.precio_actual > 0);
  if (bajas.length === 0) return null;
  return bajas.slice().sort((a, b) => a.variacion_pct - b.variacion_pct)[0];
}

/**
 * Mensaje de respaldo: sale tal cual si Gemini no está disponible.
 *
 * Dice "bajó" y no "está más barato" a propósito: el verbo no lleva género y
 * así el aviso funciona igual para el jitomate que para la papa, sin depender
 * de que el artículo del catálogo esté bien puesto.
 */
function mensajeBase(op, mercado, idioma = 'es') {
  const pct = Math.abs(op.variacion_pct);
  const de = money(op.precio_referencia);
  const a = money(op.precio_actual);
  if (idioma === 'en') {
    return `${cap(op.clave)} is down ${pct}% this week at ${mercado}: ${de} → ${a} per kilo. Wholesale price, not store price.`;
  }
  return `En ${mercado} ${op.articulo || 'el'} ${op.clave} bajó ${pct}% esta semana: ${de} → ${a} el kilo. Es precio de central, no de tienda.`;
}

/**
 * Redacta con Gemini a partir de números YA calculados. El modelo solo escoge
 * palabras; si se pasa de largo, se pone mandón, o borra de dónde salió el
 * dato, se usa el mensaje base.
 */
async function redactar(op, mercado, idioma, deps) {
  if (!deps || !deps.generarTexto) return mensajeBase(op, mercado, idioma);
  const base = mensajeBase(op, mercado, idioma);
  try {
    const texto = await deps.generarTexto(
      `Eres CALC, un copiloto financiero para personas de la economía informal en México. ` +
        `Escribe UN aviso corto (máximo 30 palabras), cálido y en ${idioma === 'en' ? 'inglés' : 'español'} sencillo. ` +
        `REGLAS: usa EXACTAMENTE estos números, no calcules ni inventes ninguno; ` +
        `NOMBRA la central de abasto y deja claro que es precio de MAYOREO en la central, no de tienda; ` +
        `informa, NUNCA des una orden (la persona decide); sin emojis, sin comillas.\n` +
        `Producto: ${op.articulo || 'el'} ${op.clave} (respeta ese género al escribir). Central: ${mercado}. ` +
        `Precio de las semanas pasadas: ${money(op.precio_referencia)} el kilo. ` +
        `Esta semana: ${money(op.precio_actual)} el kilo. Bajó ${Math.abs(op.variacion_pct)}%.`
    );
    const limpio = String(texto || '')
      .trim()
      .replace(/^["']|["']$/g, '');
    // Ordenar comprar es tan malo como ordenar no comprar: CALC no sabe si a
    // esa persona le sobran $300 esta semana.
    const mandon = /\b(debes? comprar|tienes que comprar|compra ya|apr[oó]vecha ya|apúrate)\b/i.test(
      limpio
    );
    // Si el modelo se comió el nombre de la central, el aviso deja de ser
    // honesto: parecería un precio de tienda. Se cae al base sin discutir.
    const sinFuente = !limpio.toLowerCase().includes(mercado.toLowerCase().slice(0, 12));
    if (!limpio || limpio.length > 220 || mandon || sinFuente) return base;
    return limpio;
  } catch {
    return base;
  }
}

/**
 * Corrida completa: raspa, guarda en caché y avisa a quien corresponda.
 *
 * La caché se escribe SIEMPRE, aunque no haya oportunidad que avisar: es la
 * base de datos de precios de central que después sirve para responder
 * "¿está caro el jitomate?" sin volver a molestar a SNIIM.
 *
 * @returns {object} resumen de la corrida (queda en los logs del job)
 */
async function ejecutar({
  store,
  generarTexto,
  mercadoId = MERCADO_DEFAULT,
  ahora = new Date().toISOString(),
  productos = PRODUCTOS,
  fetchImpl,
  pausaMs
} = {}) {
  const inicio = Date.now();
  const foto = await recolectar({ mercadoId, ahora, productos, fetchImpl, pausaMs });

  const resumen = {
    agente: 'market-watch',
    ejecutado_en: ahora,
    mercado: foto.mercado_nombre,
    productos_con_datos: foto.productos.length,
    productos_fallidos: foto.fallos.length,
    oportunidad: null,
    avisos_creados: 0,
    errores: 0
  };

  // Sin datos no se guarda nada: es preferible conservar la foto de ayer a
  // pisarla con una vacía porque el sitio del gobierno amaneció caído.
  if (foto.productos.length === 0) {
    resumen.duracion_ms = Date.now() - inicio;
    resumen.nota = 'SNIIM no devolvió datos utilizables; se conserva la caché anterior';
    return resumen;
  }

  await store.saveMarketPrices(foto.mercado_id, foto.fecha, {
    mercado_nombre: foto.mercado_nombre,
    actualizado_en: foto.actualizado_en,
    productos: foto.productos,
    fuente: 'SNIIM — Secretaría de Economía'
  });

  const op = mejorOportunidad(foto.productos);
  if (!op) {
    resumen.duracion_ms = Date.now() - inicio;
    return resumen;
  }
  resumen.oportunidad = {
    producto: op.clave,
    variacion_pct: op.variacion_pct,
    precio_actual: op.precio_actual
  };

  const mensaje = await redactar(op, foto.mercado_nombre, 'es', { generarTexto });
  const uids = await store.listUserIds();

  for (const uid of uids) {
    try {
      const previos = await store.getNotices(uid).catch(() => []);
      const yaAvisado = previos.some(
        (a) =>
          a.agente === 'market-watch' &&
          a.producto === op.clave &&
          a.created_at &&
          diasEntre(a.created_at, ahora) < DIAS_SILENCIO
      );
      if (yaAvisado) continue;

      await store.addNotice(uid, {
        tipo: 'mercado_oportunidad',
        agente: 'market-watch',
        producto: op.clave,
        mercado_id: foto.mercado_id,
        mercado_nombre: foto.mercado_nombre,
        precio_actual: op.precio_actual,
        precio_referencia: op.precio_referencia,
        variacion_pct: op.variacion_pct,
        fuente: 'SNIIM — Secretaría de Economía',
        mensaje,
        leido: false,
        created_at: ahora
      });
      resumen.avisos_creados += 1;
    } catch (err) {
      resumen.errores += 1;
      console.error(`[market-watch] usuario falló: ${err.message}`);
    }
  }

  resumen.duracion_ms = Date.now() - inicio;
  return resumen;
}

module.exports = {
  ejecutar,
  recolectar,
  mejorOportunidad,
  mensajeBase,
  redactar,
  UMBRAL_BAJA_PCT,
  DIAS_SILENCIO,
  DIAS_VENTANA
};
