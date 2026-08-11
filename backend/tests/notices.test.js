// dotenv carga el .env real (AUTH_MODE=privy), así que cada prueba fija el
// modo que necesita antes de cargar la app. Misma convención que capa15.
process.env.AUTH_MODE = 'dev';
process.env.STORE = 'memory';

const request = require('supertest');

jest.mock('../src/services/gemini', () => ({
  parseTexto: jest.fn(),
  parseReceipt: jest.fn(),
  buildSystemPrompt: () => '',
  MODEL: 'test'
}));

const { createApp } = require('../src/index');
const { getStore, resetStore } = require('../src/services/store');

const auth = (uid) => ({ Authorization: `Bearer dev:${uid}` });

describe('GET /notices — lo que dejaron los agentes', () => {
  let app;

  beforeEach(() => {
    if (resetStore) resetStore();
    app = createApp();
  });

  test('sin sesión → 401 (son datos del usuario)', async () => {
    const res = await request(app).get('/notices');
    expect(res.status).toBe(401);
    expect(res.body.requiere_login).toBe(true);
  });

  test('sin avisos devuelve lista vacía, no error', async () => {
    const res = await request(app).get('/notices').set(auth('rosa'));
    expect(res.status).toBe(200);
    expect(res.body.avisos).toEqual([]);
  });

  test('devuelve los no leídos, del más nuevo al más viejo', async () => {
    const store = getStore();
    await store.addNotice('rosa', {
      tipo: 'precio_subio', producto: 'azucar', mensaje: 'viejo',
      leido: false, created_at: '2026-08-01T09:00:00.000Z'
    });
    await store.addNotice('rosa', {
      tipo: 'precio_subio', producto: 'cafe', mensaje: 'nuevo',
      leido: false, created_at: '2026-08-09T09:00:00.000Z'
    });

    const res = await request(app).get('/notices').set(auth('rosa'));
    expect(res.body.avisos.map((a) => a.mensaje)).toEqual(['nuevo', 'viejo']);
  });

  test('no muestra los ya leídos', async () => {
    const store = getStore();
    await store.addNotice('rosa', {
      producto: 'sal', mensaje: 'ya visto', leido: true,
      created_at: '2026-08-09T09:00:00.000Z'
    });
    const res = await request(app).get('/notices').set(auth('rosa'));
    expect(res.body.avisos).toEqual([]);
  });

  test('los avisos de una persona no se ven desde otra cuenta', async () => {
    const store = getStore();
    await store.addNotice('rosa', {
      producto: 'azucar', mensaje: 'privado', leido: false,
      created_at: '2026-08-09T09:00:00.000Z'
    });
    const res = await request(app).get('/notices').set(auth('intruso'));
    expect(res.body.avisos).toEqual([]);
  });

  test('marcar como leído lo saca de la lista y no vuelve', async () => {
    const store = getStore();
    const id = await store.addNotice('rosa', {
      producto: 'azucar', mensaje: 'subió', leido: false,
      created_at: '2026-08-09T09:00:00.000Z'
    });

    const marcado = await request(app).post(`/notices/${id}/leido`).set(auth('rosa'));
    expect(marcado.status).toBe(200);

    const res = await request(app).get('/notices').set(auth('rosa'));
    expect(res.body.avisos).toEqual([]);
  });
});
