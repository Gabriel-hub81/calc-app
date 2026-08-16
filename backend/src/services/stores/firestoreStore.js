/**
 * Store en Firestore (producción). Modelo de datos:
 *
 * users/{uid}/entries/{entryId}      — cada venta, gasto o compra
 * users/{uid}/price_history/{productId} — historial de precios por producto canónico
 *
 * NOTA: el backend usa el SDK de servidor (bypassa security rules). Las rules
 * de firestore.rules protegen el acceso directo desde clientes (Sesión 3+).
 */
class FirestoreStore {
  constructor() {
    // require perezoso: el modo memoria no necesita credenciales de Google Cloud
    const { Firestore } = require('@google-cloud/firestore');
    this.db = new Firestore();
  }

  _entries(uid) {
    return this.db.collection('users').doc(uid).collection('entries');
  }

  _prices(uid) {
    return this.db.collection('users').doc(uid).collection('price_history');
  }

  async addEntry(uid, entry) {
    const ref = await this._entries(uid).add(entry);
    return ref.id;
  }

  async getEntries(uid, { from, to } = {}) {
    let q = this._entries(uid).orderBy('created_at');
    if (from) q = q.where('created_at', '>=', from);
    if (to) q = q.where('created_at', '<=', to);
    const snap = await q.get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async addPricePoints(uid, points) {
    const { FieldValue } = require('@google-cloud/firestore');
    const batch = this.db.batch();
    for (const p of points) {
      const ref = this._prices(uid).doc(p.product_id);
      batch.set(
        ref,
        {
          name_canonical: p.name_canonical,
          purchases: FieldValue.arrayUnion({
            unit_price: p.unit_price,
            date: p.date,
            entry_id: p.entry_id
          })
        },
        { merge: true }
      );
    }
    await batch.commit();
  }

  async getPriceHistory(uid, productId) {
    const doc = await this._prices(uid).doc(productId).get();
    return doc.exists ? doc.data() : null;
  }

  // --- Usadas por los agentes (trabajos programados) ---

  /**
   * IDs de todos los usuarios. listDocuments() incluye documentos "fantasma"
   * (los que solo existen porque tienen subcolecciones), que es justo nuestro
   * caso: nunca escribimos un documento de perfil en users/{uid}.
   */
  async listUserIds() {
    const refs = await this.db.collection('users').listDocuments();
    return refs.map((r) => r.id);
  }

  _notices(uid) {
    return this.db.collection('users').doc(uid).collection('notices');
  }

  async addNotice(uid, notice) {
    const ref = await this._notices(uid).add(notice);
    return ref.id;
  }

  async getNotices(uid, { since } = {}) {
    let q = this._notices(uid).orderBy('created_at', 'desc');
    if (since) q = q.where('created_at', '>=', since);
    const snap = await q.get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  /**
   * Contador de uso por día y usuario. Un documento por día con incrementos
   * atómicos: barato de escribir y suficiente para calcular el costo unitario.
   */
  async recordUsage(uid, tipo, dia) {
    const { FieldValue } = require('@google-cloud/firestore');
    await this.db
      .collection('usage')
      .doc(dia)
      .collection('users')
      .doc(uid)
      .set({ [tipo]: FieldValue.increment(1), dia, uid }, { merge: true });
  }

  async getUsage(dia) {
    const snap = await this.db.collection('usage').doc(dia).collection('users').get();
    return snap.docs.map((d) => ({ uid: d.id, dia, texto: 0, vision: 0, ...d.data() }));
  }

  async markNoticeRead(uid, noticeId) {
    await this._notices(uid).doc(noticeId).set({ leido: true }, { merge: true });
    return true;
  }

  async getAllPriceHistories(uid) {
    const snap = await this._prices(uid).get();
    return snap.docs.map((d) => ({ product_id: d.id, ...d.data() }));
  }

  // --- Precios de central de abasto (SNIIM) ---
  //
  //   mercados/{mercadoId}/dias/{yyyy-mm-dd}
  //
  // Colección de primer nivel a propósito: NO es dato de una usuaria, es dato
  // público del mercado. Se raspa una vez al día y lo lee toda la app; ninguna
  // petición de usuaria toca el sitio del gobierno.

  _mercadoDias(mercadoId) {
    return this.db.collection('mercados').doc(String(mercadoId)).collection('dias');
  }

  async saveMarketPrices(mercadoId, fecha, datos) {
    await this._mercadoDias(mercadoId)
      .doc(fecha)
      .set({ mercado_id: String(mercadoId), fecha, ...datos }, { merge: true });
  }

  async getMarketPrices(mercadoId, fecha) {
    const doc = await this._mercadoDias(mercadoId).doc(fecha).get();
    return doc.exists ? doc.data() : null;
  }

  /** El día más reciente que se alcanzó a guardar. Si SNIIM se cayó hoy, la
   *  app sigue respondiendo con lo de ayer en vez de quedarse muda. */
  async getLatestMarketPrices(mercadoId) {
    const snap = await this._mercadoDias(mercadoId).orderBy('fecha', 'desc').limit(1).get();
    return snap.empty ? null : snap.docs[0].data();
  }
}

module.exports = { FirestoreStore };
