const request = require('supertest');

// Mock del servicio Gemini: estos tests cubren el contrato del endpoint y el
// evaluador, sin red. La accuracy contra Gemini real se mide con `npm run accuracy`.
jest.mock('../src/services/gemini', () => ({
  parseTexto: jest.fn(),
  parseReceipt: jest.fn(),
  MODEL: 'mock'
}));

const { parseTexto } = require('../src/services/gemini');
const { createApp } = require('../src/index');
const { evaluateExpression, EvaluationError } = require('../src/services/evaluator');

describe('evaluator (mathjs, nunca eval)', () => {
  test('evalúa aritmética básica', () => {
    expect(evaluateExpression('3 * 4')).toBe(12);
    expect(evaluateExpression('450 / 3 + 17')).toBe(167);
    expect(evaluateExpression('(10 - 7) / 7 * 100')).toBe(42.857);
  });

  test('redondea a 2 decimales en dinero, 3 en el resto', () => {
    expect(evaluateExpression('10 / 3', true)).toBe(3.33);
    expect(evaluateExpression('10 / 3', false)).toBe(3.333);
    expect(evaluateExpression('3 * 4 - 5 / 7')).toBe(11.286);
  });

  test('rechaza cualquier símbolo fuera de la aritmética', () => {
    expect(() => evaluateExpression('process.exit(1)')).toThrow(EvaluationError);
    expect(() => evaluateExpression('sqrt(16)')).toThrow(EvaluationError);
    expect(() => evaluateExpression('2^10')).toThrow(EvaluationError);
    expect(() => evaluateExpression('5 % 2')).toThrow(EvaluationError); // % = módulo en mathjs
    expect(() => evaluateExpression('a + 1')).toThrow(EvaluationError);
  });

  test('división por cero → error claro', () => {
    expect(() => evaluateExpression('100 / 0')).toThrow(EvaluationError);
  });

  test('expresión vacía o no-string → error', () => {
    expect(() => evaluateExpression('')).toThrow(EvaluationError);
    expect(() => evaluateExpression(undefined)).toThrow(EvaluationError);
  });
});

describe('POST /calculate', () => {
  let app;
  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp({ rateLimits: { perMinute: 1000, perDay: 10000 } });
  });

  test('flujo exitoso: parseo ok → mathjs calcula → respuesta completa', async () => {
    parseTexto.mockResolvedValue({
      tipo: 'ok',
      expresion: '0.15 * 800',
      idioma: 'es',
      confianza: 'alta',
      correcciones: { quinze: 'quince', varos: 'pesos' },
      es_dinero: true
    });

    const res = await request(app)
      .post('/calculate')
      .send({ texto: 'cuanto es el quinze por ciento de ochosientos varos' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      resultado: 120,
      expresion_parseada: '0.15 * 800',
      idioma_detectado: 'es',
      confianza: 'alta',
      correcciones: { quinze: 'quince', varos: 'pesos' },
      es_dinero: true
    });
  });

  test('dinero se redondea a 2 decimales', async () => {
    parseTexto.mockResolvedValue({
      tipo: 'ok', expresion: '100 / 3', idioma: 'es', confianza: 'alta',
      correcciones: {}, es_dinero: true
    });
    const res = await request(app).post('/calculate').send({ texto: '100 pesos entre 3' });
    expect(res.body.resultado).toBe(33.33);
  });

  test('ambigüedad: se pregunta, no se adivina', async () => {
    parseTexto.mockResolvedValue({
      tipo: 'ambiguo',
      mensaje: '¿Quisiste decir 15% de 800, o 15 por cada 800?',
      opciones: ['0.15 * 800', '15 / 800'],
      idioma: 'es'
    });
    const res = await request(app).post('/calculate').send({ texto: 'quince por ochocientos' });
    expect(res.status).toBe(200);
    expect(res.body.ambiguo).toBe(true);
    expect(res.body.opciones).toHaveLength(2);
    expect(res.body.resultado).toBeUndefined();
  });

  test('sin operación matemática → error amable con sugerencia', async () => {
    parseTexto.mockResolvedValue({
      tipo: 'error',
      mensaje: 'No encontré una operación matemática en tu mensaje. ¿Lo puedes reformular?',
      sugerencia: "Ejemplo: 'cuánto es 250 por 3'",
      idioma: 'es'
    });
    const res = await request(app).post('/calculate').send({ texto: 'hola como estas' });
    expect(res.status).toBe(200);
    expect(res.body.error).toBe(true);
    expect(res.body.sugerencia).toBeTruthy();
  });

  test('si Gemini devuelve una expresión insegura, el evaluador la rechaza', async () => {
    parseTexto.mockResolvedValue({
      tipo: 'ok', expresion: 'require("fs")', idioma: 'es', confianza: 'alta',
      correcciones: {}, es_dinero: false
    });
    const res = await request(app).post('/calculate').send({ texto: 'x' });
    expect(res.status).toBe(200);
    expect(res.body.error).toBe(true);
    expect(res.body.resultado).toBeUndefined();
  });

  test('división por cero → error claro, nunca Infinity', async () => {
    parseTexto.mockResolvedValue({
      tipo: 'ok', expresion: '100 / 0', idioma: 'es', confianza: 'alta',
      correcciones: {}, es_dinero: false
    });
    const res = await request(app).post('/calculate').send({ texto: '100 entre 0' });
    expect(res.body.error).toBe(true);
    expect(res.body.mensaje).toMatch(/cero/i);
  });

  test('texto faltante o vacío → 400', async () => {
    expect((await request(app).post('/calculate').send({})).status).toBe(400);
    expect((await request(app).post('/calculate').send({ texto: '   ' })).status).toBe(400);
  });

  test('texto demasiado largo → 400', async () => {
    const res = await request(app).post('/calculate').send({ texto: 'x'.repeat(501) });
    expect(res.status).toBe(400);
  });

  test('idioma inválido → 400', async () => {
    const res = await request(app).post('/calculate').send({ texto: '2+2', idioma: 'fr' });
    expect(res.status).toBe(400);
  });

  test('fallo de Gemini → 502 con mensaje amable, sin detalles internos', async () => {
    parseTexto.mockRejectedValue(new Error('boom interno'));
    const res = await request(app).post('/calculate').send({ texto: '2+2' });
    expect(res.status).toBe(502);
    expect(res.body.error).toBe(true);
    expect(JSON.stringify(res.body)).not.toMatch(/boom/);
  });
});

describe('rate limiting por dispositivo', () => {
  test('respeta el límite por X-Device-Id y responde 429 amable', async () => {
    parseTexto.mockResolvedValue({
      tipo: 'ok', expresion: '2 + 2', idioma: 'es', confianza: 'alta',
      correcciones: {}, es_dinero: false
    });
    const app = createApp({ rateLimits: { perMinute: 3, perDay: 100 } });

    for (let i = 0; i < 3; i++) {
      const ok = await request(app)
        .post('/calculate')
        .set('X-Device-Id', 'device-test-12345')
        .send({ texto: '2+2' });
      expect(ok.status).toBe(200);
    }
    const blocked = await request(app)
      .post('/calculate')
      .set('X-Device-Id', 'device-test-12345')
      .send({ texto: '2+2' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.mensaje).toMatch(/Demasiadas consultas/);

    // otro dispositivo no está bloqueado
    const other = await request(app)
      .post('/calculate')
      .set('X-Device-Id', 'device-other-9999')
      .send({ texto: '2+2' });
    expect(other.status).toBe(200);
  });
});

describe('health', () => {
  test('GET /health → ok', async () => {
    const app = createApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
