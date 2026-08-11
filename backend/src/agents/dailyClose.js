/**
 * AGENTE CIERRE DEL DÍA
 *
 * Cada noche cierra la cuenta del día por cada usuaria y le deja el resumen
 * esperando: cuánto vendió, cuánto gastó, cómo le fue comparado con sus últimos
 * días. Es el trabajo que hoy hacen a mano, cansadas, antes de dormir.
 *
 * REGLAS DE DISEÑO (las mismas del vigía de precios):
 * 1. Si no hubo movimiento, NO escribe nada. Un resumen de un día vacío es
 *    ruido, y el ruido diario mata la confianza en los avisos.
 * 2. Toda la aritmética en código (ledger + mathjs). Gemini solo elige palabras
 *    y solo puede usar los números que ya se calcularon.
 * 3. Si Gemini falla, el resumen sale igual con el mensaje base.
 * 4. Nunca juzga ("mal día", "vas fatal"). Informa y, si acaso, celebra.
 */
const { summarize, round2, round1, money } = require('../services/ledger');

const DIAS_COMPARACION = 7;

function inicioDelDia(iso) {
  const d = new Date(iso);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Calcula el cierre de un día a partir de los movimientos del propio usuario.
 * Devuelve null si no hubo nada que cerrar.
 */
function calcularCierre(entries, ahora = new Date().toISOString()) {
  const hoyIni = inicioDelDia(ahora);
  const deHoy = entries.filter((e) => new Date(e.created_at) >= hoyIni);
  if (deHoy.length === 0) return null;

  const hoy = summarize(deHoy, 'hoy');

  // Comparación con los días anteriores QUE TUVIERON movimiento: comparar
  // contra días cerrados sin ventas haría ver bien cualquier día mediocre.
  const desde = new Date(hoyIni);
  desde.setUTCDate(desde.getUTCDate() - DIAS_COMPARACION);
  const previos = entries.filter((e) => {
    const f = new Date(e.created_at);
    return f >= desde && f < hoyIni;
  });

  const porDia = new Map();
  for (const e of previos) {
    const clave = new Date(e.created_at).toISOString().slice(0, 10);
    if (!porDia.has(clave)) porDia.set(clave, []);
    porDia.get(clave).push(e);
  }

  let promedioVentas = null;
  let comparacion = null;
  if (porDia.size > 0) {
    const ventasPorDia = [...porDia.values()].map((es) => summarize(es, 'hoy').ventas);
    promedioVentas = round2(ventasPorDia.reduce((s, v) => s + v, 0) / ventasPorDia.length);
    if (promedioVentas > 0) {
      const pct = round1((hoy.ventas / promedioVentas - 1) * 100);
      comparacion = {
        promedio_dias_previos: promedioVentas,
        dias_comparados: porDia.size,
        diferencia_pct: pct
      };
    }
  }

  return {
    ventas: hoy.ventas,
    gastos: hoy.gastos,
    balance: hoy.balance,
    ganancia_ventas: hoy.ganancia_ventas,
    movimientos: deHoy.length,
    comparacion
  };
}

/** Mensaje de respaldo: se usa tal cual si Gemini no está disponible. */
function mensajeBase(c) {
  const partes = [];
  if (c.ventas > 0) partes.push(`vendiste ${money(c.ventas)}`);
  if (c.gastos > 0) partes.push(`gastaste ${money(c.gastos)}`);
  let m = `Cierre de hoy: ${partes.join(' y ')}. Te quedan ${money(c.balance)}.`;

  if (c.comparacion) {
    const { diferencia_pct: pct, dias_comparados: dias } = c.comparacion;
    if (pct >= 10) {
      m += ` Vendiste ${Math.abs(pct)}% más que tus últimos ${dias} días con movimiento.`;
    } else if (pct <= -10) {
      m += ` Vendiste ${Math.abs(pct)}% menos que tus últimos ${dias} días con movimiento.`;
    }
  }
  return m;
}

/** Redacta con Gemini a partir de números YA calculados. Nunca ordena ni juzga. */
async function redactar(c, deps) {
  const base = mensajeBase(c);
  if (!deps || !deps.generarTexto) return base;
  try {
    const texto = await deps.generarTexto(
      `Eres CALC, copiloto financiero para personas de la economía informal en México. ` +
        `Escribe UN cierre del día, máximo 25 palabras, cálido y en español sencillo. ` +
        `REGLAS: usa EXACTAMENTE estos números, no calcules ni inventes ninguno; ` +
        `no juzgues a la persona ni le des consejos ni órdenes; sin emojis; una sola frase.\n` +
        `Ventas de hoy: ${money(c.ventas)}. Gastos: ${money(c.gastos)}. Balance: ${money(c.balance)}.` +
        (c.comparacion
          ? ` Comparado con el promedio de sus últimos ${c.comparacion.dias_comparados} días con movimiento (${money(c.comparacion.promedio_dias_previos)}), hoy fue ${c.comparacion.diferencia_pct}%.`
          : '')
    );
    const limpio = String(texto || '').trim().replace(/^["']|["']$/g, '');
    const juzga = /deberías|tienes que|mal día|vas mal|esfuérzate/i.test(limpio);
    if (!limpio || limpio.length > 220 || juzga) return base;
    return limpio;
  } catch {
    return base;
  }
}

async function ejecutar({ store, generarTexto, ahora = new Date().toISOString() }) {
  const inicio = Date.now();
  const uids = await store.listUserIds();
  const resumen = {
    agente: 'daily-close',
    ejecutado_en: ahora,
    usuarios_revisados: uids.length,
    cierres_creados: 0,
    dias_sin_movimiento: 0,
    errores: 0
  };

  for (const uid of uids) {
    try {
      const entries = await store.getEntries(uid);
      const cierre = calcularCierre(entries, ahora);
      if (!cierre) {
        resumen.dias_sin_movimiento += 1;
        continue;
      }

      const mensaje = await redactar(cierre, { generarTexto });
      await store.addNotice(uid, {
        tipo: 'cierre_dia',
        agente: 'daily-close',
        ventas: cierre.ventas,
        gastos: cierre.gastos,
        balance: cierre.balance,
        movimientos: cierre.movimientos,
        comparacion_pct: cierre.comparacion ? cierre.comparacion.diferencia_pct : null,
        mensaje,
        leido: false,
        created_at: ahora
      });
      resumen.cierres_creados += 1;
    } catch (err) {
      resumen.errores += 1;
      console.error(`[daily-close] usuario falló: ${err.message}`);
    }
  }

  resumen.duracion_ms = Date.now() - inicio;
  return resumen;
}

module.exports = { ejecutar, calcularCierre, mensajeBase, redactar };
