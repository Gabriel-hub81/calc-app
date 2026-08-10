const express = require('express');
const { parseReceipt } = require('../services/gemini');
const { requireAuth } = require('../middleware/auth');
const { getStore } = require('../services/store');
const { summarize, rangeFor, round2, money } = require('../services/ledger');
const { pricePointsFromEntry, alertsForItems } = require('../services/priceHelper');

const router = express.Router();

const MAX_IMAGE_BASE64_CHARS = 8 * 1024 * 1024; // ~6 MB de imagen real
const CUADRE_TOLERANCIA = 0.01; // ±1% del total del ticket

/**
 * Validación de cuadre — NO NEGOCIABLE: la suma de los artículos debe
 * coincidir con el total del ticket. Si no cuadra, se reporta; nunca se
 * guarda en silencio un ticket que no cuadra.
 */
function validarCuadre(propuesta) {
  const items = Array.isArray(propuesta.items) ? propuesta.items : [];
  const suma = round2(
    items.reduce((s, it) => {
      const total =
        typeof it.total === 'number' ? it.total : (it.qty || 1) * (it.unit_price || 0);
      return s + total;
    }, 0)
  );
  const total = typeof propuesta.total_ticket === 'number' ? propuesta.total_ticket : null;

  if (total === null) {
    return { status: 'mismatch', suma_articulos: suma, diferencia: null,
      mensaje: 'No pude leer el total del ticket. Revísalo y captúralo a mano.' };
  }
  const tolerancia = Math.max(0.01, Math.abs(total) * CUADRE_TOLERANCIA);
  const diferencia = round2(suma - total);
  if (Math.abs(diferencia) <= tolerancia) {
    return { status: 'ok', suma_articulos: suma, diferencia: 0 };
  }
  return {
    status: 'mismatch',
    suma_articulos: suma,
    diferencia,
    mensaje: `Los artículos suman ${money(suma)} pero el ticket dice ${money(total)} (diferencia de ${money(Math.abs(diferencia))}). Revisa los renglones antes de guardar.`
  };
}

/**
 * POST /receipt — foto de ticket → propuesta estructurada.
 * NO requiere login y NO guarda nada: siempre devuelve una PROPUESTA que el
 * usuario debe confirmar (posiblemente editada) vía POST /receipt/confirm.
 * Nunca se auto-guarda dinero leído por OCR.
 */
router.post('/', async (req, res) => {
  const { imagen_base64, mime_type } = req.body || {};

  if (typeof imagen_base64 !== 'string' || imagen_base64.length === 0) {
    return res.status(400).json({
      error: true,
      mensaje: 'Necesito la foto del ticket.',
      sugerencia: 'Envía { "imagen_base64": "...", "mime_type": "image/jpeg" }'
    });
  }
  if (imagen_base64.length > MAX_IMAGE_BASE64_CHARS) {
    return res.status(400).json({
      error: true,
      mensaje: 'La foto es demasiado grande.',
      sugerencia: 'Comprime la imagen a menos de 6 MB e intenta de nuevo.'
    });
  }
  const mime = mime_type || 'image/jpeg';
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(mime)) {
    return res.status(400).json({
      error: true,
      mensaje: 'Formato de imagen no soportado.',
      sugerencia: 'Usa JPG, PNG, WebP o HEIC.'
    });
  }

  let propuesta;
  try {
    propuesta = await parseReceipt(imagen_base64, mime);
  } catch (err) {
    console.error('[gemini-vision] fallo al leer ticket:', err.message);
    return res.status(502).json({
      error: true,
      mensaje: 'No pude leer tu ticket en este momento. Intenta de nuevo.',
      sugerencia: 'Procura que la foto esté bien iluminada y el ticket extendido.'
    });
  }

  if (propuesta.items.length === 0) {
    return res.json({
      error: true,
      mensaje: 'No encontré artículos legibles en el ticket.',
      sugerencia: 'Intenta con una foto más cercana y con buena luz.'
    });
  }

  const cuadre = validarCuadre(propuesta);
  return res.json({
    propuesta,
    status: cuadre.status,
    suma_articulos: cuadre.suma_articulos,
    diferencia: cuadre.diferencia,
    mensaje:
      cuadre.status === 'ok'
        ? 'Revisa los artículos y confirma si así compraste.'
        : cuadre.mensaje
  });
});

/**
 * POST /receipt/confirm — guarda la propuesta YA CONFIRMADA por el usuario
 * (posiblemente editada en el cliente). Requiere login. El cuadre se vuelve
 * a validar en código: si después de editar sigue sin cuadrar, no se guarda.
 */
router.post('/confirm', requireAuth, async (req, res) => {
  const { propuesta } = req.body || {};
  if (!propuesta || !Array.isArray(propuesta.items) || propuesta.items.length === 0) {
    return res.status(400).json({
      error: true,
      mensaje: 'Necesito la propuesta del ticket con sus artículos.',
      sugerencia: 'Envía { "propuesta": { items: [...], total_ticket: ... } }'
    });
  }

  for (const it of propuesta.items) {
    const qty = it.qty !== undefined ? it.qty : 1;
    // Los importes negativos son legítimos: descuentos, cupones y devoluciones
    // vienen así en los tickets reales. Quien vigila que no entre basura es el
    // cuadre (la suma tiene que dar el total del ticket), no el signo.
    // El nombre canónico se deriva del texto leído si el modelo no lo dio:
    // un renglón con nombre y precio no debe bloquear una compra entera.
    const nombre = it.name_canonical || it.name_raw;
    if (
      typeof it.unit_price !== 'number' || !Number.isFinite(it.unit_price) ||
      typeof qty !== 'number' || !Number.isFinite(qty) || qty <= 0 ||
      !nombre
    ) {
      return res.status(400).json({
        error: true,
        mensaje: `Hay un artículo con datos incompletos${it.name_raw ? ` ("${it.name_raw}")` : ''}.`,
        sugerencia: 'Cada artículo necesita nombre, cantidad y precio.'
      });
    }
  }

  const cuadre = validarCuadre(propuesta);
  if (cuadre.status !== 'ok') {
    return res.status(422).json({
      error: true,
      mensaje: cuadre.mensaje,
      suma_articulos: cuadre.suma_articulos,
      diferencia: cuadre.diferencia
    });
  }

  const entry = {
    type: 'purchase',
    description: `Ticket${propuesta.comercio ? ` ${propuesta.comercio}` : ''}`,
    items: propuesta.items.map((it) => ({
      name_raw: it.name_raw || it.name_canonical,
      name_canonical: String(it.name_canonical || it.name_raw).toLowerCase().trim(),
      qty: it.qty !== undefined ? it.qty : 1,
      unit_price: round2(it.unit_price),
      total: round2(typeof it.total === 'number' ? it.total : (it.qty || 1) * it.unit_price)
    })),
    amount_total: round2(propuesta.total_ticket),
    source: 'receipt',
    currency: propuesta.moneda || 'MXN',
    created_at: new Date().toISOString()
  };

  const store = getStore();
  try {
    // Alertas ANTES de guardar los puntos nuevos (no contaminar el promedio)
    const alertas = await alertsForItems(store, req.uid, entry.items);
    const entryId = await store.addEntry(req.uid, entry);
    const points = pricePointsFromEntry(entry, entryId);
    if (points.length > 0) await store.addPricePoints(req.uid, points);

    const hoy = await store.getEntries(req.uid, rangeFor('hoy'));
    return res.json({
      guardado: true,
      mensaje: `Anotada tu compra de ${money(entry.amount_total)}${propuesta.comercio ? ` en ${propuesta.comercio}` : ''}.`,
      entry: { id: entryId, ...entry },
      alertas_precio: alertas,
      resumen_dia: summarize(hoy, 'hoy')
    });
  } catch (err) {
    console.error('[store] fallo al guardar ticket:', err.message);
    return res.status(500).json({
      error: true,
      mensaje: 'No pude guardar tu ticket. Intenta de nuevo en un momento.'
    });
  }
});

module.exports = router;
