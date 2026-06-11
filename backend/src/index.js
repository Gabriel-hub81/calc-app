require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const calculateRouter = require('./routes/calculate');
const receiptRouter = require('./routes/receipt');
const pricesRouter = require('./routes/prices');
const verifyRouter = require('./routes/verify');
const { createRateLimiters } = require('./middleware/rateLimit');
const { optionalAuth } = require('./middleware/auth');

function createApp(options = {}) {
  const app = express();

  // Cloud Run corre detrás de un proxy
  app.set('trust proxy', 1);

  app.use(helmet());

  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.use(
    cors({
      origin: allowedOrigins.length > 0 ? allowedOrigins : true,
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'X-Device-Id', 'Authorization']
    })
  );

  // /receipt recibe imágenes en base64 → límite de body más grande, solo ahí
  app.use('/receipt', express.json({ limit: '12mb' }));
  app.use(express.json({ limit: '10kb' }));

  app.get('/health', (_req, res) => res.json({ ok: true }));

  const { minuteLimiter, dayLimiter } = createRateLimiters(options.rateLimits);
  app.use('/calculate', dayLimiter, minuteLimiter, optionalAuth, calculateRouter);
  app.use('/receipt', dayLimiter, minuteLimiter, receiptRouter);
  app.use('/prices', dayLimiter, minuteLimiter, pricesRouter);
  app.use('/verify', dayLimiter, minuteLimiter, verifyRouter);

  // 404 amable
  app.use((_req, res) => {
    res.status(404).json({ error: true, mensaje: 'Ruta no encontrada.' });
  });

  return app;
}

if (require.main === module) {
  const port = process.env.PORT || 8080;
  createApp().listen(port, () => {
    console.log(`CALC backend escuchando en :${port}`);
  });
}

module.exports = { createApp };
