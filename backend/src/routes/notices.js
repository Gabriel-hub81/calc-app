const express = require('express');
const { getStore } = require('../services/store');

const router = express.Router();
const MAX_AVISOS = 5;

/**
 * Avisos que dejaron los agentes mientras el usuario no estaba.
 * Los crea el vigía de precios (src/agents/priceWatch.js) corriendo solo cada
 * mañana; aquí solo se leen y se marcan como vistos. Requiere sesión: son
 * datos del usuario.
 */

/** GET /notices — los no leídos, del más nuevo al más viejo. */
router.get('/', async (req, res) => {
  try {
    const store = getStore();
    const todos = await store.getNotices(req.uid);
    const noLeidos = todos
      .filter((n) => !n.leido)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, MAX_AVISOS);

    return res.json({ avisos: noLeidos, total: noLeidos.length });
  } catch (err) {
    console.error('[notices] no se pudieron leer:', err.message);
    // Un fallo aquí nunca debe estorbar el uso normal de la app
    return res.json({ avisos: [], total: 0 });
  }
});

/** POST /notices/:id/leido — el usuario ya lo vio. */
router.post('/:id/leido', async (req, res) => {
  try {
    await getStore().markNoticeRead(req.uid, req.params.id);
    return res.json({ ok: true });
  } catch (err) {
    console.error('[notices] no se pudo marcar como leído:', err.message);
    return res.status(500).json({ error: true, mensaje: 'No pude guardar eso. Intenta de nuevo.' });
  }
});

module.exports = router;
