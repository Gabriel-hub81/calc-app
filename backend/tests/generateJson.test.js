const { generateJson } = require('../src/services/gemini');

// Fake del cliente de Gemini: devuelve las respuestas en orden y registra
// cada request para poder inspeccionar la config de los reintentos.
function fakeAi(texts) {
  const requests = [];
  let i = 0;
  return {
    requests,
    models: {
      generateContent: async (req) => {
        requests.push(req);
        return { text: texts[Math.min(i++, texts.length - 1)] };
      }
    }
  };
}

const TRUNCADO = '{"intent": "calc", "tipo": "ok", "expresion": "100 / 0"';
const COMPLETO = '{"intent": "calc", "tipo": "error", "mensaje": "no se puede dividir entre cero"}';
const REQUEST = { model: 'm', contents: 'x', config: { systemInstruction: 'sp', temperature: 0 } };

describe('generateJson', () => {
  test('el primer intento va tal cual, con temperature 0', async () => {
    const ai = fakeAi([COMPLETO]);
    await generateJson(ai, REQUEST);
    expect(ai.requests).toHaveLength(1);
    expect(ai.requests[0].config.temperature).toBe(0);
  });

  test('ante JSON truncado reintenta con temperatura > 0 (el corte a temp 0 es determinista)', async () => {
    const ai = fakeAi([TRUNCADO, COMPLETO]);
    const parsed = await generateJson(ai, REQUEST);
    expect(parsed.tipo).toBe('error');
    expect(ai.requests).toHaveLength(2);
    expect(ai.requests[1].config.temperature).toBeGreaterThan(0);
    // El resto de la config se preserva en el reintento
    expect(ai.requests[1].config.systemInstruction).toBe('sp');
    expect(ai.requests[1].model).toBe('m');
  });

  test('no muta el request original al reintentar', async () => {
    const ai = fakeAi([TRUNCADO, COMPLETO]);
    await generateJson(ai, REQUEST);
    expect(REQUEST.config.temperature).toBe(0);
  });

  test('agota los reintentos y lanza el último error — nunca devuelve JSON parcial', async () => {
    const ai = fakeAi([TRUNCADO, TRUNCADO, TRUNCADO]);
    await expect(generateJson(ai, REQUEST)).rejects.toThrow(/truncado/);
    expect(ai.requests).toHaveLength(3); // 1 intento + 2 reintentos
  });
});

// --- Fallas transitorias de Gemini (503 saturado, 429 cuota del minuto) ---

/** Cliente que truena `fallos` veces y luego responde bien. */
function aiQueTruena(fallos, mensajeError, texto = COMPLETO) {
  let intentos = 0;
  return {
    llamadas: () => intentos,
    models: {
      generateContent: async () => {
        intentos += 1;
        if (intentos <= fallos) throw new Error(mensajeError);
        return { text: texto };
      }
    }
  };
}

describe('generateJson — Gemini teniendo un mal día', () => {
  test('un 503 no llega al usuario: se reintenta y sale bien', async () => {
    // Pasó de verdad el 16/08/2026: el modelo saturado tiró la lectura de
    // ticket en producción. La petición estaba bien; el servidor no.
    const ai = aiQueTruena(1, '{"error":{"code":503,"status":"UNAVAILABLE"}}');
    const parsed = await generateJson(ai, REQUEST);
    expect(parsed.tipo).toBe('error');
    expect(ai.llamadas()).toBe(2);
  });

  test('también reintenta la cuota del minuto (429)', async () => {
    const ai = aiQueTruena(2, 'RESOURCE_EXHAUSTED: 429 quota');
    await expect(generateJson(ai, REQUEST)).resolves.toBeDefined();
    expect(ai.llamadas()).toBe(3);
  });

  test('si Gemini sigue caído, se rinde y avisa — no se inventa la respuesta', async () => {
    const ai = aiQueTruena(99, '503 UNAVAILABLE');
    await expect(generateJson(ai, REQUEST)).rejects.toThrow(/503/);
  });

  test('un error de la petición NO se reintenta: reintentarlo falla igual', async () => {
    const ai = aiQueTruena(99, 'API key not valid');
    await expect(generateJson(ai, REQUEST)).rejects.toThrow(/API key/);
    expect(ai.llamadas()).toBe(1);
  });
});
