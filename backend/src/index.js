require('dotenv').config();

const fs = require('fs');
const path = require('path');
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

  // CSP desactivada: este servicio también sirve la PWA, y el SDK de Privy
  // necesita conectarse/embeber iframes de privy.io — una CSP estricta lo
  // rompería en silencio. El resto de cabeceras de helmet siguen activas.
  app.use(helmet({ contentSecurityPolicy: false }));

  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  // Fuera de producción también se aceptan orígenes de red privada (probar
  // desde el celular en el mismo WiFi) — la IP de la máquina cambia y no
  // vamos a perseguirla en .env. En producción manda ALLOWED_ORIGINS, punto.
  const isPrivateLan = (origin) =>
    process.env.NODE_ENV !== 'production' &&
    /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}):\d+$/.test(origin);
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin || allowedOrigins.includes(origin) || isPrivateLan(origin)) {
          return cb(null, true);
        }
        if (allowedOrigins.length === 0) return cb(null, true);
        return cb(null, false);
      },
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

  // En producción el mismo servicio sirve la PWA (carpeta public/, generada
  // por el build del frontend en el Dockerfile). Un solo origen = sin CORS.
  const staticDir = path.join(__dirname, '..', 'public');
  const indexHtml = path.join(staticDir, 'index.html');
  if (fs.existsSync(indexHtml)) {
    app.use(express.static(staticDir));
    // Fallback SPA: cualquier GET que no sea del API devuelve la app
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      res.sendFile(indexHtml);
    });
  }

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
