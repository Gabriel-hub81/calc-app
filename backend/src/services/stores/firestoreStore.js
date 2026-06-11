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

  async getAllPriceHistories(uid) {
    const snap = await this._prices(uid).get();
    return snap.docs.map((d) => ({ product_id: d.id, ...d.data() }));
  }
}

module.exports = { FirestoreStore };
