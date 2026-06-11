/**
 * Store en memoria: desarrollo local y tests, sin emulador ni credenciales.
 * Implementa la misma interfaz que FirestoreStore.
 */
class MemoryStore {
  constructor() {
    this.reset();
  }

  reset() {
    this.users = new Map(); // uid -> { entries: [], prices: Map<productId, history> }
    this.seq = 0;
  }

  _user(uid) {
    if (!this.users.has(uid)) {
      this.users.set(uid, { entries: [], prices: new Map() });
    }
    return this.users.get(uid);
  }

  async addEntry(uid, entry) {
    const id = `e${++this.seq}`;
    this._user(uid).entries.push({ ...entry, id });
    return id;
  }

  async getEntries(uid, { from, to } = {}) {
    return this._user(uid).entries.filter(
      (e) => (!from || e.created_at >= from) && (!to || e.created_at <= to)
    );
  }

  async addPricePoints(uid, points) {
    const prices = this._user(uid).prices;
    for (const p of points) {
      if (!prices.has(p.product_id)) {
        prices.set(p.product_id, { name_canonical: p.name_canonical, purchases: [] });
      }
      prices.get(p.product_id).purchases.push({
        unit_price: p.unit_price,
        date: p.date,
        entry_id: p.entry_id
      });
    }
  }

  async getPriceHistory(uid, productId) {
    return this._user(uid).prices.get(productId) || null;
  }

  async getAllPriceHistories(uid) {
    return [...this._user(uid).prices.entries()].map(([product_id, h]) => ({
      product_id,
      ...h
    }));
  }
}

module.exports = { MemoryStore };
