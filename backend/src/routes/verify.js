const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { computeCalcHash, registerOnChain, isOnChainEnabled } = require('../services/solana');

const router = express.Router();

/**
 * POST /verify — "guardar comprobante": acción OPCIONAL que el usuario elige.
 * Calcula el hash canónico del cálculo y, si Solana está configurado, lo
 * registra on-chain. REGLA: si Solana falla, el cálculo igual es válido —
 * la verificación es un plus, nunca un bloqueo.
 *
 * Body: { expresion: "0.15 * 800", resultado: 120 }
 */
router.post('/', requireAuth, async (req, res) => {
  const { expresion, resultado } = req.body || {};

  if (typeof expresion !== 'string' || expresion.trim().length === 0 || typeof resultado !== 'number') {
    return res.status(400).json({
      error: true,
      mensaje: 'Necesito la operación y su resultado para guardar el comprobante.',
      sugerencia: 'Envía { "expresion": "0.15 * 800", "resultado": 120 }'
    });
  }

  const timestamp = Date.now();
  const { hex, bytes } = computeCalcHash({
    expresion,
    resultado,
    timestamp,
    wallet: req.uid
  });

  if (!isOnChainEnabled()) {
    return res.json({
      verificado: false,
      registro_pendiente: true,
      hash: hex,
      timestamp,
      mensaje: 'Tu comprobante quedó generado. El registro en la red estará disponible próximamente.'
    });
  }

  try {
    const { txId, explorerUrl } = await registerOnChain(bytes);
    return res.json({
      verificado: true,
      hash: hex,
      timestamp,
      tx_id: txId,
      explorer_url: explorerUrl,
      mensaje: 'Comprobante guardado.'
    });
  } catch (err) {
    // Solana es capa de verificación, no de bloqueo
    console.error('[solana] fallo al registrar (el cálculo sigue siendo válido):', err.message);
    return res.json({
      verificado: false,
      registro_pendiente: true,
      hash: hex,
      timestamp,
      mensaje: 'No pude guardar el comprobante en la red en este momento, pero tu cálculo es válido. Intenta más tarde.'
    });
  }
});

module.exports = router;
