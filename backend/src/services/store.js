const { MemoryStore } = require('./stores/memoryStore');

let instance = null;

/**
 * Factory del store. STORE=memory|firestore (env var).
 * Default: firestore en producción, memoria en desarrollo/tests.
 */
function getStore() {
  if (!instance) {
    const mode =
      process.env.STORE ||
      (process.env.NODE_ENV === 'production' ? 'firestore' : 'memory');
    if (mode === 'firestore') {
      const { FirestoreStore } = require('./stores/firestoreStore');
      instance = new FirestoreStore();
    } else {
      instance = new MemoryStore();
    }
  }
  return instance;
}

/** Solo para tests (modo memoria). */
function resetStore() {
  if (instance && typeof instance.reset === 'function') instance.reset();
}

module.exports = { getStore, resetStore };
