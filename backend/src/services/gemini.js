const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

// Modelo SIEMPRE desde env var para poder cambiarlo sin tocar código.
// Verifica el modelo vigente en https://ai.google.dev/gemini-api/docs/models
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

let client = null;
function getClient() {
  if (!client) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY no está configurada');
    }
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return client;
}

// Los few-shot viven en el mismo archivo que el test suite (few_shot: true):
// mejorar uno mejora el otro.
function loadFewShotExamples() {
  const casesPath = path.join(__dirname, '..', '..', 'tests', 'test_cases.json');
  const cases = JSON.parse(fs.readFileSync(casesPath, 'utf8'));
  return cases.filter((c) => c.few_shot);
}

function exampleToJson(c) {
  if (c.ambiguous) {
    return {
      tipo: 'ambiguo',
      mensaje: c.note ? `Necesito aclarar: ${c.note}` : '¿Me puedes dar más detalle?',
      opciones: [],
      idioma: 'es'
    };
  }
  if (c.error) {
    return {
      tipo: 'error',
      mensaje: 'No encontré una operación matemática en tu mensaje. ¿Lo puedes reformular?',
      sugerencia: "Ejemplo: 'cuánto es 250 por 3'",
      idioma: 'es'
    };
  }
  return {
    tipo: 'ok',
    expresion: c.expected_expression,
    idioma: c.profile === 'english' ? 'en' : 'es',
    confianza: 'alta',
    correcciones: c.corrections || {},
    es_dinero: Boolean(c.es_dinero)
  };
}

function buildSystemPrompt() {
  const examples = loadFewShotExamples()
    .map((c) => `Usuario: ${c.input}\nJSON: ${JSON.stringify(exampleToJson(c))}`)
    .join('\n\n');

  return `Eres el motor de parseo matemático de CALC, un copiloto financiero para microempresarios y hogares de LatAm. Tu única tarea: convertir lo que dice el usuario en lenguaje natural (español, inglés o portugués, posiblemente con errores de ortografía y coloquialismos) en una expresión aritmética.

REGLAS:
1. Devuelve SOLO JSON válido, sin markdown, sin texto extra.
2. NUNCA calcules el resultado. Solo extrae la expresión — otro sistema la evalúa.
3. La expresión solo puede contener: dígitos, + - * / ( ) y punto decimal. Convierte porcentajes a decimales ("15% de 800" → "0.15 * 800"). NUNCA uses el símbolo %.
4. Corrige ortografía y coloquialismos antes de parsear y repórtalos en "correcciones". Generaliza — no dependas de una lista cerrada. Coloquialismos MX de dinero: "lana", "varo", "baro", "feria" = pesos. "el doble de X" = X * 2; "la mitad de X" = X / 2; "un tercio de X" = X / 3.
5. Marca "es_dinero": true cuando la operación involucra montos monetarios (precios, pesos, dólares, sueldos, propinas).
6. En cantidades de dinero la tolerancia a errores es CERO. Si hay ambigüedad real sobre un monto o sobre qué operación quiere el usuario, devuelve tipo "ambiguo" con una pregunta clara y las opciones. NUNCA adivines montos de dinero.
7. Si el mensaje no contiene ninguna operación matemática, devuelve tipo "error" con un mensaje amable y una sugerencia.
8. Detecta el idioma del usuario ("es", "en" o "pt") y repórtalo en "idioma".
9. Contexto útil de LatAm: IVA en México = 16%. "Quincenal" = 2 veces al mes. Promoción "3 por 2" = pagas 2 de cada 3. "Medio kilo a X el kilo" = X / 2.
10. "confianza": "alta" si el parseo es directo; "media" si corregiste mucho o inferiste algo; "baja" si dudas del parseo (y considera si debería ser "ambiguo", sobre todo con dinero).

FORMATOS DE SALIDA (exactamente uno de estos tres):
{"tipo":"ok","expresion":"0.15 * 800","idioma":"es","confianza":"alta","correcciones":{"quinze":"quince"},"es_dinero":true}
{"tipo":"ambiguo","mensaje":"¿Quisiste decir 15% de 800, o 15 por cada 800?","opciones":["0.15 * 800","15 / 800"],"idioma":"es"}
{"tipo":"error","mensaje":"No encontré una operación matemática en tu mensaje. ¿Lo puedes reformular?","sugerencia":"Ejemplo: 'cuánto es 250 por 3'","idioma":"es"}

EJEMPLOS:

${examples}`;
}

// Cacheamos el system prompt (lee disco solo una vez por proceso)
let cachedSystemPrompt = null;
function getSystemPrompt() {
  if (!cachedSystemPrompt) cachedSystemPrompt = buildSystemPrompt();
  return cachedSystemPrompt;
}

function extractJson(text) {
  // Tolerante a fences de markdown por si el modelo los agrega pese a la instrucción
  const cleaned = text.replace(/```(?:json)?/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error(`Respuesta de Gemini sin JSON: ${text.slice(0, 200)}`);
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

/**
 * Parsea texto en lenguaje natural a una de tres salidas: ok / ambiguo / error.
 * @param {string} texto
 * @param {string} [idioma] - hint opcional; Gemini detecta solo
 * @returns {Promise<object>}
 */
async function parseTexto(texto, idioma) {
  const ai = getClient();
  const userContent = idioma ? `[idioma sugerido: ${idioma}] ${texto}` : texto;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: userContent,
    config: {
      systemInstruction: getSystemPrompt(),
      responseMimeType: 'application/json',
      temperature: 0
    }
  });

  const parsed = extractJson(response.text);
  if (!['ok', 'ambiguo', 'error'].includes(parsed.tipo)) {
    throw new Error(`Tipo de respuesta inesperado de Gemini: ${parsed.tipo}`);
  }
  return parsed;
}

module.exports = { parseTexto, buildSystemPrompt, MODEL };
