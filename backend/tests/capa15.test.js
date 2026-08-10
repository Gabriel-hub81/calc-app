process.env.AUTH_MODE = 'dev';
process.env.STORE = 'memory';

const request = require('supertest');

jest.mock('../src/services/gemini', () => ({
  parseTexto: jest.fn(),
  parseReceipt: jest.fn(),
  MODEL: 'mock'
}));

const { parseTexto, parseReceipt } = require('../src/services/gemini');
const { createApp } = require('../src/index');
const { resetStore } = require('../src/services/store');
const { buildEntry, LedgerError } = require('../src/services/ledger');

const auth = (uid) => ({ Authorization: `Bearer dev:${uid}` });

const REGISTRO_VENTA = {
  intent: 'register',
  registro: {
    tipo: 'venta',
    items: [
      { nombre: 'chocolates', nombre_canonico: 'chocolate', cantidad: 10, precio_unitario: 10, costo_unitario: 7 }
    ],
    moneda: 'MXN'
  },
  idioma: 'es'
};

const ticket = (items, total) => ({
  comercio: 'Super Test',
  fecha: '2026-06-11',
  moneda: 'MXN',
  items,
  total_ticket: total
});

const aceite = (precio) => ({
  name_raw: 'ACEITE 1L',
  name_canonical: 'aceite vegetal 1l',
  qty: 1,
  unit_price: precio,
  total: precio
});

let app;
beforeEach(() => {
  jest.clearAllMocks();
  resetStore();
  app = createApp({ rateLimits: { perMinute: 10000, perDay: 100000 } });
});

describe('ledger (la aritmética vive en código, nunca en el LLM)', () => {
  test('venta con costo: total, ganancia y margen calculados en código', () => {
    const entry = buildEntry(REGISTRO_VENTA.registro);
    expect(entry.amount_total).toBe(100);
    expect(entry.ganancia).toBe(30);
    expect(entry.margen_pct).toBe(30);
    expect(entry.type).toBe('sale');
  });

  test('item sin precio → LedgerError (nunca inventar montos)', () => {
    expect(() =>
      buildEntry({ tipo: 'venta', items: [{ nombre: 'collares', cantidad: 3 }] })
    ).toThrow(LedgerError);
  });
});

describe('intent routing en POST /calculate', () => {
  test('register (venta): guarda, calcula margen en código y devuelve resumen del día', async () => {
    parseTexto.mockResolvedValue(REGISTRO_VENTA);
    const res = await request(app)
      .post('/calculate')
      .set(auth('user1'))
      .send({ texto: 'hoy vendi 10 chocolates a 10 pesos que compre a 7' });

    expect(res.status).toBe(200);
    expect(res.body.registrado).toBe(true);
    expect(res.body.entry.amount_total).toBe(100);
    expect(res.body.entry.ganancia).toBe(30);
    expect(res.body.entry.margen_pct).toBe(30);
    expect(res.body.mensaje).toMatch(/margen 30%/);
    expect(res.body.resumen_dia.ventas).toBe(100);
  });

  test('register sin login → 401 con mensaje amable (sin jerga)', async () => {
    parseTexto.mockResolvedValue(REGISTRO_VENTA);
    const res = await request(app)
      .post('/calculate')
      .send({ texto: 'vendi 10 chocolates a 10' });

    expect(res.status).toBe(401);
    expect(res.body.requiere_login).toBe(true);
    expect(res.body.mensaje).toMatch(/correo o teléfono/);
    expect(JSON.stringify(res.body)).not.toMatch(/wallet|token|auth/i);
  });

  test('register ambiguo: se pregunta, no se anota', async () => {
    parseTexto.mockResolvedValue({
      intent: 'register',
      tipo: 'ambiguo',
      mensaje: '¿A cuánto vendiste cada collar?',
      opciones: [],
      idioma: 'es'
    });
    const res = await request(app)
      .post('/calculate')
      .set(auth('user1'))
      .send({ texto: 'vendi unos collares' });

    expect(res.status).toBe(200);
    expect(res.body.ambiguo).toBe(true);
    expect(res.body.registrado).toBeUndefined();
  });

  test('query: suma del periodo calculada en código', async () => {
    parseTexto.mockResolvedValueOnce(REGISTRO_VENTA);
    await request(app).post('/calculate').set(auth('user1')).send({ texto: 'vendi...' });

    parseTexto.mockResolvedValueOnce({ intent: 'query', consulta: { periodo: 'hoy' }, idioma: 'es' });
    const res = await request(app)
      .post('/calculate')
      .set(auth('user1'))
      .send({ texto: 'como voy hoy' });

    expect(res.status).toBe(200);
    expect(res.body.consulta).toBe(true);
    expect(res.body.ventas).toBe(100);
    expect(res.body.ganancia_ventas).toBe(30);
    expect(res.body.mensaje).toMatch(/Hoy llevas/);
  });

  test('query sin login → 401', async () => {
    parseTexto.mockResolvedValue({ intent: 'query', consulta: { periodo: 'hoy' }, idioma: 'es' });
    const res = await request(app).post('/calculate').send({ texto: 'como voy' });
    expect(res.status).toBe(401);
  });

  test('calc sigue funcionando sin login (compatibilidad Sesión 1)', async () => {
    parseTexto.mockResolvedValue({
      intent: 'calc', tipo: 'ok', expresion: '0.15 * 800', idioma: 'es',
      confianza: 'alta', correcciones: {}, es_dinero: true
    });
    const res = await request(app).post('/calculate').send({ texto: '15% de 800' });
    expect(res.body.resultado).toBe(120);
  });
});

describe('POST /receipt — propuesta, cuadre y confirmación', () => {
  test('ticket que cuadra → propuesta con status ok, y NO se guarda nada', async () => {
    parseReceipt.mockResolvedValue(ticket([aceite(45), { ...aceite(20), name_raw: 'JABON', name_canonical: 'jabon' }], 65));
    const res = await request(app)
      .post('/receipt')
      .set(auth('user1'))
      .send({ imagen_base64: 'Zm90bw==', mime_type: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.propuesta.items).toHaveLength(2);
    expect(res.body.suma_articulos).toBe(65);

    // nada guardado: el día del usuario sigue vacío
    parseTexto.mockResolvedValue({ intent: 'query', consulta: { periodo: 'hoy' }, idioma: 'es' });
    const q = await request(app).post('/calculate').set(auth('user1')).send({ texto: 'como voy' });
    expect(q.body.gastos).toBe(0);
  });

  test('ticket que NO cuadra → status mismatch con diferencia explicada', async () => {
    parseReceipt.mockResolvedValue(ticket([aceite(45), { ...aceite(20), name_canonical: 'jabon' }], 100));
    const res = await request(app)
      .post('/receipt')
      .set(auth('user1'))
      .send({ imagen_base64: 'Zm90bw==' });

    expect(res.body.status).toBe('mismatch');
    expect(res.body.diferencia).toBe(-35);
    expect(res.body.mensaje).toMatch(/no cuadra|diferencia|Revisa/i);
  });

  test('confirm guarda la compra y actualiza el día', async () => {
    const res = await request(app)
      .post('/receipt/confirm')
      .set(auth('maria'))
      .send({ propuesta: ticket([aceite(45), { ...aceite(20), name_canonical: 'jabon' }], 65) });

    expect(res.status).toBe(200);
    expect(res.body.guardado).toBe(true);
    expect(res.body.resumen_dia.gastos).toBe(65);
    expect(res.body.entry.source).toBe('receipt');
  });

  test('confirm con propuesta que no cuadra → 422 y NO se guarda', async () => {
    const res = await request(app)
      .post('/receipt/confirm')
      .set(auth('maria'))
      .send({ propuesta: ticket([aceite(45)], 100) });

    expect(res.status).toBe(422);

    parseTexto.mockResolvedValue({ intent: 'query', consulta: { periodo: 'hoy' }, idioma: 'es' });
    const q = await request(app).post('/calculate').set(auth('maria')).send({ texto: 'como voy' });
    expect(q.body.gastos).toBe(0);
  });

  test('confirm sin login → 401', async () => {
    const res = await request(app)
      .post('/receipt/confirm')
      .send({ propuesta: ticket([aceite(45)], 45) });
    expect(res.status).toBe(401);
  });

  test('sin imagen → 400', async () => {
    const res = await request(app).post('/receipt').set(auth('user1')).send({});
    expect(res.status).toBe(400);
  });

  test('leer ticket sin login → 401 (la operación más cara exige sesión)', async () => {
    const res = await request(app)
      .post('/receipt')
      .send({ imagen_base64: 'Zm90bw==', mime_type: 'image/jpeg' });
    expect(res.status).toBe(401);
    expect(res.body.requiere_login).toBe(true);
  });
});

describe('helper de precios v0 — contra el historial del propio usuario', () => {
  const confirmar = (uid, precio) =>
    request(app)
      .post('/receipt/confirm')
      .set(auth(uid))
      .send({ propuesta: ticket([aceite(precio)], precio) });

  test('subida >10% → alerta con porcentaje correcto', async () => {
    const primera = await confirmar('maria', 38);
    expect(primera.body.alertas_precio).toHaveLength(0); // sin historial aún

    const segunda = await confirmar('maria', 45);
    expect(segunda.body.alertas_precio).toHaveLength(1);
    const alerta = segunda.body.alertas_precio[0];
    expect(alerta.producto).toBe('aceite vegetal 1l');
    expect(alerta.precio_promedio).toBe(38);
    expect(alerta.diferencia_pct).toBeCloseTo(18.4, 0);
    expect(alerta.mensaje).toMatch(/más caro/);
  });

  test('subida ≤10% → sin alerta (no alarmar de más)', async () => {
    await confirmar('luis', 38);
    const segunda = await confirmar('luis', 40); // +5.3%
    expect(segunda.body.alertas_precio).toHaveLength(0);
  });

  test('GET /prices/summary: qué estoy comprando más caro', async () => {
    await confirmar('maria', 38);
    await confirmar('maria', 45);

    const res = await request(app).get('/prices/summary').set(auth('maria'));
    expect(res.status).toBe(200);
    expect(res.body.productos).toHaveLength(1);
    expect(res.body.productos[0].producto).toBe('aceite vegetal 1l');
    expect(res.body.productos[0].diferencia_pct).toBeCloseTo(18.4, 0);
  });

  test('GET /prices/summary sin login → 401', async () => {
    const res = await request(app).get('/prices/summary');
    expect(res.status).toBe(401);
  });

  test('el historial de un usuario NO contamina al de otro', async () => {
    await confirmar('maria', 38);
    const otra = await confirmar('pedro', 45); // primera compra de pedro
    expect(otra.body.alertas_precio).toHaveLength(0);
  });
});
