/**
 * Autenticación con interfaz limpia para cambiar de proveedor.
 *
 * AUTH_MODE=dev   → token "dev:<uid>" (desarrollo y tests, nunca producción)
 * AUTH_MODE=privy → verificación del JWT del wallet embebido (se cablea en la
 *                   Sesión 3 cuando exista el app ID de Privy; mientras tanto
 *                   rechaza todo, que es el default seguro)
 *
 * Los endpoints de cálculo puro NO requieren auth; registro/consulta SÍ.
 */
function authMode() {
  return (
    process.env.AUTH_MODE ||
    (process.env.NODE_ENV === 'production' ? 'privy' : 'dev')
  );
}

function verifyToken(token) {
  const mode = authMode();
  if (mode === 'dev') {
    if (token.startsWith('dev:') && token.length > 4) {
      return { uid: token.slice(4) };
    }
    return null;
  }
  if (mode === 'privy') {
    // Sesión 3: verificar con @privy-io/server-auth → verifyAuthToken(token)
    // y mapear el DID de Privy a uid. Hasta entonces: rechazar.
    return null;
  }
  return null;
}

function extractUid(req) {
  const header = req.get('Authorization');
  if (!header || !header.startsWith('Bearer ')) return null;
  const verified = verifyToken(header.slice(7));
  return verified ? verified.uid : null;
}

/** Adjunta req.uid si hay token válido; nunca bloquea. */
function optionalAuth(req, _res, next) {
  req.uid = extractUid(req);
  next();
}

/** Bloquea sin token válido — con mensaje amable, sin jerga técnica. */
function requireAuth(req, res, next) {
  req.uid = extractUid(req);
  if (!req.uid) {
    return res.status(401).json({
      requiere_login: true,
      mensaje: 'Para guardar tu día, entra con tu correo o teléfono.'
    });
  }
  next();
}

module.exports = { optionalAuth, requireAuth };
