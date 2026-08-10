/**
 * parseTexto valida el intent que devuelve Gemini contra una lista blanca.
 * Esa lista se olvidó al agregar "comparar" y tumbó la función en producción
 * pese a que el prompt, la ruta y el comparador estaban bien: cada intent
 * soportado necesita una prueba que recorra el camino COMPLETO.
 */
const respuestas = [];

jest.mock('@google/genai', () => ({
  GoogleGenAI: class {
    constructor() {
      this.models = {
        generateContent: async () => ({ text: respuestas.shift() })
      };
    }
  }
}));

process.env.GEMINI_API_KEY = 'llave-de-prueba';
const { parseTexto } = require('../src/services/gemini');

describe('parseTexto — todos los intents soportados pasan el validador', () => {
  afterEach(() => {
    respuestas.length = 0;
  });

  test('comparar', async () => {
    respuestas.push(
      JSON.stringify({
        intent: 'comparar',
        opciones: [
          { etiqueta: 'la bolsa de 2 kg', precio: 245, cantidad: 2, unidad: 'kg' },
          { etiqueta: 'la bolsa de 6.81 kg', precio: 1050, cantidad: 6.81, unidad: 'kg' }
        ],
        idioma: 'es'
      })
    );
    const r = await parseTexto('cual me conviene, 2 kg a 245 o 6.81 kg a 1050');
    expect(r.intent).toBe('comparar');
    expect(r.opciones).toHaveLength(2);
  });

  test('calc', async () => {
    respuestas.push(
      JSON.stringify({ intent: 'calc', tipo: 'ok', expresion: '0.15 * 800', idioma: 'es' })
    );
    const r = await parseTexto('15% de 800');
    expect(r.intent).toBe('calc');
  });

  test('register', async () => {
    respuestas.push(
      JSON.stringify({
        intent: 'register',
        registro: { tipo: 'venta', items: [], moneda: 'MXN' },
        idioma: 'es'
      })
    );
    const r = await parseTexto('vendi 3 tortas a 25');
    expect(r.intent).toBe('register');
  });

  test('query', async () => {
    respuestas.push(JSON.stringify({ intent: 'query', consulta: { periodo: 'hoy' }, idioma: 'es' }));
    const r = await parseTexto('como voy hoy');
    expect(r.intent).toBe('query');
  });

  test('sin intent explícito se asume calc', async () => {
    respuestas.push(JSON.stringify({ tipo: 'ok', expresion: '2 + 2', idioma: 'es' }));
    const r = await parseTexto('2 mas 2');
    expect(r.intent).toBe('calc');
  });

  test('un intent inventado sí se rechaza (la lista blanca sigue viva)', async () => {
    respuestas.push(JSON.stringify({ intent: 'transferir_dinero', idioma: 'es' }));
    await expect(parseTexto('mandale 500 a mi primo')).rejects.toThrow(/Intent inesperado/);
  });
});
