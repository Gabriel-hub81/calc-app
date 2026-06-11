require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const calculateRouter = require('./routes/calculate');
const { createRateLimiters } = require('./middleware/rateLimit');

function createApp(options = {}) {
  const app = express();

  // Cloud Run corre detrás de un proxy
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(express.json({ limit: '10kb' }));

  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.use(
    cors({
      origin: allowedOrigins.length > 0 ? allowedOrigins : true,
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'X-Device-Id']
    })
  );

  app.get('/health', (_req, res) => res.json({ ok: true }));

  const { minuteLimiter, dayLimiter } = createRateLimiters(options.rateLimits);
  app.use('/calculate', dayLimiter, minuteLimiter, calculateRouter);

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
