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
    this.mercados = new Map(); // "mercadoId|fecha" -> precios de central de abasto
    this.seq = 0;
  }

  _user(uid) {
    if (!this.users.has(uid)) {
      this.users.set(uid, { entries: [], prices: new Map(), notices: [] });
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

  // --- Usadas por los agentes (trabajos programados) ---

  async listUserIds() {
    return [...this.users.keys()];
  }

  async addNotice(uid, notice) {
    const u = this._user(uid);
    if (!u.notices) u.notices = [];
    const id = `n${++this.seq}`;
    u.notices.push({ ...notice, id });
    return id;
  }

  async getNotices(uid, { since } = {}) {
    const list = this._user(uid).notices || [];
    return since ? list.filter((n) => n.created_at >= since) : list;
  }

  async recordUsage(uid, tipo, dia) {
    if (!this.usage) this.usage = new Map();
    const clave = `${dia}|${uid}`;
    const actual = this.usage.get(clave) || { dia, uid, texto: 0, vision: 0 };
    actual[tipo] = (actual[tipo] || 0) + 1;
    this.usage.set(clave, actual);
  }

  async getUsage(dia) {
    return [...(this.usage || new Map()).values()].filter((u) => u.dia === dia);
  }

  async markNoticeRead(uid, noticeId) {
    const n = (this._user(uid).notices || []).find((x) => x.id === noticeId);
    if (n) n.leido = true;
    return Boolean(n);
  }

  async getAllPriceHistories(uid) {
    return [...this._user(uid).prices.entries()].map(([product_id, h]) => ({
      product_id,
      ...h
    }));
  }

  // --- Precios de central de abasto (SNIIM) ---
  // Ojo: NO cuelgan de un usuario. Son dato público del mercado, iguales para
  // todas: se raspan una vez al día y sirven a toda la app.

  async saveMarketPrices(mercadoId, fecha, datos) {
    this.mercados.set(`${mercadoId}|${fecha}`, { mercado_id: String(mercadoId), fecha, ...datos });
  }

  async getMarketPrices(mercadoId, fecha) {
    return this.mercados.get(`${mercadoId}|${fecha}`) || null;
  }

  /** El día más reciente que se alcanzó a guardar. Si SNIIM se cayó hoy, la
   *  app sigue respondiendo con lo de ayer en vez de quedarse muda. */
  async getLatestMarketPrices(mercadoId) {
    return (
      [...this.mercados.values()]
        .filter((d) => d.mercado_id === String(mercadoId))
        .sort((a, b) => b.fecha.localeCompare(a.fecha))[0] || null
    );
  }
}

module.exports = { MemoryStore };
