const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getStore } = require('../services/store');
const { priceSummary } = require('../services/priceHelper');

const router = express.Router();

/**
 * GET /prices/summary — "¿qué estoy comprando más caro?"
 * Comparación contra el propio historial del usuario (helper de precios v0).
 */
router.get('/summary', requireAuth, async (req, res) => {
  try {
    const resumen = await priceSummary(getStore(), req.uid);
    return res.json(resumen);
  } catch (err) {
    console.error('[prices] fallo en resumen:', err.message);
    return res.status(500).json({
      error: true,
      mensaje: 'No pude consultar tus precios. Intenta de nuevo en un momento.'
    });
  }
});

module.exports = router;
