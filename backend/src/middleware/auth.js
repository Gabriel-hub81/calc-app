/**
 * Autenticación con interfaz limpia para cambiar de proveedor.
 *
 * AUTH_MODE=dev   → token "dev:<uid>" (desarrollo y tests, nunca producción)
 * AUTH_MODE=privy → verifica el JWT del wallet embebido contra el JWKS público
 *                   de Privy (ES256, iss privy.io, aud = PRIVY_APP_ID). Se usa
 *                   jose + JWKS en vez de @privy-io/server-auth a propósito:
 *                   así el servidor NO necesita el App Secret de Privy — un
 *                   secreto menos que custodiar. El uid es el DID de Privy
 *                   (did:privy:...), estable por usuario.
 *
 * Los endpoints de cálculo puro NO requieren auth; registro/consulta SÍ.
 */
const { createRemoteJWKSet, jwtVerify } = require('jose');

function authMode() {
  return (
    process.env.AUTH_MODE ||
    (process.env.NODE_ENV === 'production' ? 'privy' : 'dev')
  );
}

// JWKS remoto con caché (jose cachea las llaves y las refresca solo).
// Se memoiza por app ID por si cambia entre tests.
let jwksCache = { appId: null, jwks: null };
function getJwks(appId) {
  if (jwksCache.appId !== appId) {
    jwksCache = {
      appId,
      jwks: createRemoteJWKSet(
        new URL(`https://auth.privy.io/api/v1/apps/${appId}/jwks.json`)
      )
    };
  }
  return jwksCache.jwks;
}

async function verifyPrivyToken(token) {
  const appId = process.env.PRIVY_APP_ID;
  if (!appId) {
    console.error('AUTH_MODE=privy pero falta PRIVY_APP_ID — se rechaza todo');
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, getJwks(appId), {
      issuer: 'privy.io',
      audience: appId
    });
    return payload.sub ? { uid: payload.sub } : null;
  } catch {
    // Token inválido/expirado/de otra app: rechazo silencioso (401 amable)
    return null;
  }
}

async function verifyToken(token) {
  const mode = authMode();
  if (mode === 'dev') {
    if (token.startsWith('dev:') && token.length > 4) {
      return { uid: token.slice(4) };
    }
    return null;
  }
  if (mode === 'privy') {
    return verifyPrivyToken(token);
  }
  return null;
}

async function extractUid(req) {
  const header = req.get('Authorization');
  if (!header || !header.startsWith('Bearer ')) return null;
  const verified = await verifyToken(header.slice(7));
  return verified ? verified.uid : null;
}

/** Adjunta req.uid si hay token válido; nunca bloquea. */
async function optionalAuth(req, _res, next) {
  req.uid = await extractUid(req);
  next();
}

/** Bloquea sin token válido — con mensaje amable, sin jerga técnica. */
async function requireAuth(req, res, next) {
  req.uid = await extractUid(req);
  if (!req.uid) {
    return res.status(401).json({
      requiere_login: true,
      mensaje: 'Para guardar tu día, entra con tu correo o teléfono.'
    });
  }
  next();
}

module.exports = { optionalAuth, requireAuth };
