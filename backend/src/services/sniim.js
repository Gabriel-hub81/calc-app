/**
 * CLIENTE SNIIM — precios de mayoreo de las centrales de abasto
 *
 * Resuelve el ARRANQUE EN FRÍO del vigía de precios: hasta hoy, CALC solo
 * podía hablar del historial de la usuaria, y eso pide semanas de capturar
 * tickets antes de servir de algo. Con SNIIM, CALC sabe algo útil el día uno
 * sin que nadie haya escaneado nada.
 *
 * TRES REGLAS QUE NO SE NEGOCIAN:
 *
 * 1. ESTO ES MAYOREO, NO EL SÚPER. Los precios son por kilo en la central de
 *    abasto. Guadalupe paga el doble en el Chedraui. Prometer un precio de
 *    menudeo con datos de mayoreo es mentir. Lo que sí transfiere es la
 *    DIRECCIÓN y la TEMPORADA: "esta semana el jitomate está barato en la
 *    central" es cierto para todas. El aviso nombra siempre el mercado.
 *
 * 2. NUNCA EN LA RUTA DE UNA PETICIÓN DE USUARIA. SNIIM es un sitio de
 *    gobierno sin contrato ni API: tarda segundos, se cae, y sin User-Agent
 *    de navegador contesta 503. Un trabajo programado lo consulta una vez al
 *    día y guarda el resultado; la app lee de la caché. Si SNIIM se cae, CALC
 *    ni se entera.
 *
 * 3. LA ARITMÉTICA ES DEL CÓDIGO. Aquí no entra el modelo. Gemini solo
 *    redacta el aviso final, con los números ya calculados.
 *
 * Es raspado de HTML de una página ASP.NET: puede romperse el día que le
 * cambien el diseño. Por eso todo parseo devuelve vacío en vez de reventar, y
 * el agente reporta "sin datos" en vez de inventarlos.
 */
const { round1, round2 } = require('./ledger');

const BASE_URL =
  'https://www.economia-sniim.gob.mx/nuevo/Consultas/MercadosNacionales/' +
  'PreciosDeMercado/Agricolas/ResultadosConsultaFechaFrutasYHortalizas.aspx';

// Sin un User-Agent de navegador el servidor responde 503. No es evasión de
// nada: son datos públicos y gratuitos por mandato de la Secretaría de
// Economía; es que el servidor rechaza clientes sin encabezados de navegador.
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const TIMEOUT_MS = Number(process.env.SNIIM_TIMEOUT_MS || 30000);
// PreciosPorId=2 → precio calculado POR KILOGRAMO. El 1 devuelve el precio de
// la presentación comercial ("arpilla de 30 kg"), que no sirve para comparar.
const PRECIOS_POR_KILO = '2';

class SniimError extends Error {}

/** Date → "dd/mm/yyyy", que es como SNIIM espera las fechas. */
function aFechaMx(fecha) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

/** "dd/mm/yyyy" → "yyyy-mm-dd", que es como ordena y guarda CALC. */
function aFechaIso(mx) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(mx).trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function decodificar(s) {
  return String(s)
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .trim();
}

function aNumero(s) {
  const n = Number(String(s).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Extrae los renglones de la tabla de resultados.
 * Devuelve [] ante cualquier sorpresa — que el sitio cambie no debe tirar
 * un trabajo entero ni, peor, producir números inventados.
 */
function parseTabla(html) {
  const tabla = /<table[^>]*id="tblResultados"[\s\S]*?<\/table>/i.exec(String(html || ''));
  if (!tabla) return [];

  const filas = tabla[0].match(/<tr[\s\S]*?<\/tr>/gi) || [];
  const salida = [];

  for (const fila of filas) {
    // Solo los renglones de datos: los encabezados usan otras clases y los
    // títulos de categoría ("Hortalizas") vienen con colspan="7".
    const celdas = [...fila.matchAll(/<td[^>]*class="Datos2"[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
      decodificar(m[1].replace(/<[^>]*>/g, ''))
    );
    if (celdas.length < 6) continue;

    const fecha = aFechaIso(celdas[0]);
    const frecuente = aNumero(celdas[5]);
    // El precio frecuente es el que importa: es el que de verdad se paga, no
    // el mínimo de oferta ni el máximo de una caja premium.
    if (!fecha || !(frecuente > 0)) continue;

    salida.push({
      fecha,
      presentacion: celdas[1],
      origen: celdas[2],
      precio_min: aNumero(celdas[3]),
      precio_max: aNumero(celdas[4]),
      precio_frecuente: frecuente
    });
  }

  return salida;
}

/**
 * Consulta un producto en un mercado para un rango de fechas.
 * @returns {Promise<Array>} renglones crudos (uno por origen y presentación)
 */
async function consultar({
  productoId,
  mercadoId,
  desde,
  hasta,
  fetchImpl = globalThis.fetch,
  timeoutMs = TIMEOUT_MS
}) {
  const params = new URLSearchParams({
    fechaInicio: aFechaMx(desde),
    fechaFinal: aFechaMx(hasta),
    ProductoId: String(productoId),
    OrigenId: '-1',
    Origen: 'Todos',
    DestinoId: String(mercadoId),
    Destino: '',
    PreciosPorId: PRECIOS_POR_KILO,
    RegistrosPorPagina: '1000'
  });

  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${BASE_URL}?${params}`, {
      headers: {
        'User-Agent': USER_AGENT,
        Referer: 'https://www.economia-sniim.gob.mx/nuevo/',
        'Accept-Language': 'es-MX,es'
      },
      signal: control.signal
    });
    if (!res.ok) throw new SniimError(`SNIIM respondió ${res.status}`);
    return parseTabla(await res.text());
  } catch (err) {
    if (err instanceof SniimError) throw err;
    throw new SniimError(`No se pudo consultar SNIIM: ${err.message}`);
  } finally {
    clearTimeout(reloj);
  }
}

/**
 * Un precio por día: promedio del precio frecuente entre todos los orígenes y
 * presentaciones de esa fecha.
 *
 * Por qué promediar: el mismo día hay jitomate de Sinaloa a $9 y de Puebla a
 * $14. Ninguno es "el precio"; el promedio del día es la mejor señal simple de
 * cómo amaneció el mercado.
 */
function porDia(renglones) {
  const mapa = new Map();
  for (const r of renglones) {
    if (!mapa.has(r.fecha)) mapa.set(r.fecha, []);
    mapa.get(r.fecha).push(r.precio_frecuente);
  }
  return [...mapa.entries()]
    .map(([fecha, precios]) => ({
      fecha,
      precio: round2(precios.reduce((s, p) => s + p, 0) / precios.length),
      observaciones: precios.length
    }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/**
 * Compara la semana en curso contra las semanas anteriores.
 *
 * @param {Array} renglones      salida de consultar()
 * @param {number} diasRecientes tamaño de la ventana "hoy" (default 7)
 * @returns {object|null} null si no hay suficientes datos para decir nada
 */
function resumir(renglones, { diasRecientes = 7 } = {}) {
  const dias = porDia(renglones);
  // Con menos de dos semanas no hay contra qué comparar. Callarse es la
  // respuesta correcta: un porcentaje calculado sobre tres días no dice nada.
  if (dias.length < diasRecientes + 3) return null;

  const recientes = dias.slice(-diasRecientes);
  const previos = dias.slice(0, -diasRecientes);

  const promedio = (lista) => lista.reduce((s, d) => s + d.precio, 0) / lista.length;
  const actual = promedio(recientes);
  const referencia = promedio(previos);
  if (!(referencia > 0)) return null;

  return {
    precio_actual: round2(actual),
    precio_referencia: round2(referencia),
    variacion_pct: round1((actual / referencia - 1) * 100),
    dias_recientes: recientes.length,
    dias_referencia: previos.length,
    fecha_ultima: dias[dias.length - 1].fecha,
    fecha_primera: dias[0].fecha
  };
}

module.exports = {
  consultar,
  parseTabla,
  porDia,
  resumir,
  aFechaMx,
  aFechaIso,
  SniimError,
  BASE_URL
};
