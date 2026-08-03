// AUTH_MODE=privy: el default seguro es rechazar. Los primeros tests no tocan
// la red (un token que no es JWT falla al parsear antes de bajar el JWKS); el
// último sí intenta el fetch del JWKS, pero si no hay red el fallo también
// termina en 401, así que el test es determinista offline. La ruta feliz (JWT
// real de Privy) se valida end-to-end con un login de verdad desde la PWA.
process.env.AUTH_MODE = 'privy';
process.env.PRIVY_APP_ID = 'app-id-de-prueba';
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key';

jest.mock('../src/services/gemini', () => ({
  parseTexto: jest.fn(),
  parseReceipt: jest.fn(),
  MODEL: 'mock'
}));

const request = require('supertest');
const { createApp } = require('../src/index');

describe('auth en modo privy', () => {
  const app = createApp();

  test('sin token → 401 con mensaje amable', async () => {
    const res = await request(app).get('/prices/summary');
    expect(res.status).toBe(401);
    expect(res.body.requiere_login).toBe(true);
    expect(res.body.mensaje).toMatch(/correo o teléfono/);
  });

  test('token dev:<uid> NO funciona en modo privy', async () => {
    const res = await request(app)
      .get('/prices/summary')
      .set('Authorization', 'Bearer dev:intruso');
    expect(res.status).toBe(401);
  });

  test('token basura que no es JWT → 401, sin tirar el servidor', async () => {
    const res = await request(app)
      .get('/prices/summary')
      .set('Authorization', 'Bearer no-soy-un-jwt');
    expect(res.status).toBe(401);
  });

  test('JWT bien formado pero firmado por cualquiera → 401', async () => {
    // Header/payload válidos, firma inventada: debe morir en la verificación
    const header = Buffer.from(JSON.stringify({ alg: 'ES256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      sub: 'did:privy:falso', iss: 'privy.io', aud: 'app-id-de-prueba',
      exp: Math.floor(Date.now() / 1000) + 3600
    })).toString('base64url');
    const res = await request(app)
      .get('/prices/summary')
      .set('Authorization', `Bearer ${header}.${payload}.firma-invalida`);
    expect(res.status).toBe(401);
  });
});
