const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// Clave por dispositivo/usuario, NO solo IP: las redes móviles comparten IPs
// (CGNAT) y limitar por IP castiga a usuarios legítimos. El cliente manda
// X-Device-Id; si no viene, caemos a IP (normalizada para IPv6).
function deviceKey(req) {
  const deviceId = req.get('X-Device-Id');
  if (deviceId && /^[\w-]{8,64}$/.test(deviceId)) return `dev:${deviceId}`;
  return ipKeyGenerator(req.ip);
}

const FRIENDLY_429 = {
  error: true,
  mensaje: 'Demasiadas consultas. Espera un momento.',
  sugerencia: 'Puedes volver a intentar en unos segundos.'
};

// Techo por IP que NO se puede rotar. El límite por dispositivo es cómodo pero
// su clave la manda el cliente: basta cambiar X-Device-Id en cada petición para
// estrenar cuota. Este segundo límite cuenta siempre por IP, con topes altos
// para no castigar redes móviles compartidas (CGNAT), donde muchas personas
// legítimas salen por la misma dirección.
function createIpLimiters({ ipPerMinute = 240, ipPerDay = 5000 } = {}) {
  const common = {
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: FRIENDLY_429
  };
  return {
    ipMinuteLimiter: rateLimit({ ...common, windowMs: 60 * 1000, limit: ipPerMinute }),
    ipDayLimiter: rateLimit({ ...common, windowMs: 24 * 60 * 60 * 1000, limit: ipPerDay })
  };
}

function createRateLimiters({ perMinute = 60, perDay = 1000 } = {}) {
  const minuteLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: perMinute,
    keyGenerator: deviceKey,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: FRIENDLY_429
  });

  const dayLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    limit: perDay,
    keyGenerator: deviceKey,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: FRIENDLY_429
  });

  return { minuteLimiter, dayLimiter };
}

module.exports = { createRateLimiters, createIpLimiters, deviceKey };
