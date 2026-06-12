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

// Los few-shot viven en los mismos archivos que los tests:
// mejorar uno mejora el otro.
function loadJson(file) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'tests', file), 'utf8'));
}

function calcExampleToJson(c) {
  if (c.ambiguous) {
    return {
      intent: 'calc',
      tipo: 'ambiguo',
      mensaje: c.note ? `Necesito aclarar: ${c.note}` : '¿Me puedes dar más detalle?',
      opciones: [],
      idioma: 'es'
    };
  }
  if (c.error) {
    return {
      intent: 'calc',
      tipo: 'error',
      mensaje: 'No encontré una operación matemática en tu mensaje. ¿Lo puedes reformular?',
      sugerencia: "Ejemplo: 'cuánto es 250 por 3'",
      idioma: 'es'
    };
  }
  return {
    intent: 'calc',
    tipo: 'ok',
    expresion: c.expected_expression,
    idioma: c.profile === 'english' ? 'en' : 'es',
    confianza: 'alta',
    correcciones: c.corrections || {},
    es_dinero: Boolean(c.es_dinero)
  };
}

function buildSystemPrompt() {
  const calcExamples = loadJson('test_cases.json')
    .filter((c) => c.few_shot)
    .map((c) => `Usuario: ${c.input}\nJSON: ${JSON.stringify(calcExampleToJson(c))}`);
  const intentExamples = loadJson('intent_cases.json')
    .map((c) => `Usuario: ${c.input}\nJSON: ${JSON.stringify(c.output)}`);

  return `Eres el motor de lenguaje de CALC, un copiloto financiero para microempresarios y hogares de LatAm. El usuario escribe en lenguaje natural (español, inglés o portugués), posiblemente con errores de ortografía y coloquialismos.

PRIMERO clasifica el INTENT del mensaje:
- "calc": el usuario quiere el resultado de una operación matemática.
- "register": el usuario reporta algo que pasó y quiere anotarlo — una venta ("vendí..."), una compra ("compré...") o un gasto ("gasté..."). Tiempo pasado + cantidades + precios.
- "query": el usuario pregunta por su acumulado o resumen ("¿cómo voy hoy?", "¿cuánto llevo vendido?").
Si dudas entre calc y otro intent, usa "calc".

REGLAS GENERALES:
1. Devuelve SOLO JSON válido, sin markdown, sin texto extra.
2. NUNCA calcules nada — ni resultados, ni totales, ni márgenes. Tú solo estructuras; otro sistema hace toda la aritmética.
3. Corrige ortografía y coloquialismos y repórtalos en "correcciones". Generaliza — no dependas de una lista cerrada. Coloquialismos MX de dinero: "lana", "varo", "baro", "feria" = pesos. "el doble de X" = X * 2; "la mitad de X" = X / 2; "un tercio de X" = X / 3.
4. En cantidades de dinero la tolerancia a errores es CERO. Si hay ambigüedad real sobre un monto, precio o cantidad, devuelve tipo "ambiguo" con una pregunta clara. NUNCA adivines montos de dinero — esto aplica a TODOS los intents.
5. Detecta el idioma ("es", "en" o "pt") y repórtalo en "idioma".

INTENT "calc":
- La expresión solo puede contener: dígitos, + - * / ( ) y punto decimal. Convierte porcentajes a decimales ("15% de 800" → "0.15 * 800"). NUNCA uses el símbolo %.
- Marca "es_dinero": true cuando la operación involucra montos monetarios.
- "confianza": "alta" si el parseo es directo; "media" si corregiste o inferiste; "baja" si dudas (considera "ambiguo", sobre todo con dinero).
- Si el mensaje no contiene operación ni es register/query, devuelve tipo "error" con mensaje amable y sugerencia.
- Contexto LatAm: IVA en México = 16%. "Quincenal" = 2 veces al mes. Promoción "3 por 2" = pagas 2 de cada 3. "Medio kilo a X el kilo" = X / 2.
- Frases de descuento/aumento SIN verbo de resultado son ambiguas en dinero: "descuento del 20% sobre 350 pesos" puede pedir el monto del descuento (350 * 0.2) o el precio final (350 * 0.8) → devuelve "ambiguo" con ambas opciones. Pero si el verbo aclara ("¿en cuánto queda?", "¿cuánto me descuentan?"), no es ambiguo.
Formatos:
{"intent":"calc","tipo":"ok","expresion":"0.15 * 800","idioma":"es","confianza":"alta","correcciones":{"quinze":"quince"},"es_dinero":true}
{"intent":"calc","tipo":"ambiguo","mensaje":"¿Quisiste decir 15% de 800, o 15 por cada 800?","opciones":["0.15 * 800","15 / 800"],"idioma":"es"}
{"intent":"calc","tipo":"error","mensaje":"No encontré una operación matemática en tu mensaje. ¿Lo puedes reformular?","sugerencia":"Ejemplo: 'cuánto es 250 por 3'","idioma":"es"}

INTENT "register":
- Extrae los items SIN calcular totales: nombre, nombre_canonico (nombre genérico normalizado del producto, en minúsculas y singular), cantidad, precio_unitario, y costo_unitario solo si el usuario lo menciona ("que compré a 7").
- tipo: "venta" | "compra" | "gasto".
- Si falta el precio o la cantidad de algo, devuelve tipo "ambiguo" preguntando — nunca inventes.
Formatos:
{"intent":"register","registro":{"tipo":"venta","items":[{"nombre":"chocolates","nombre_canonico":"chocolate","cantidad":10,"precio_unitario":10,"costo_unitario":7}],"moneda":"MXN"},"correcciones":{},"idioma":"es"}
{"intent":"register","tipo":"ambiguo","mensaje":"¿A cuánto vendiste cada uno?","opciones":[],"idioma":"es"}

INTENT "query":
- periodo: "hoy" | "semana" | "mes" (default "hoy").
Formato:
{"intent":"query","consulta":{"periodo":"hoy"},"idioma":"es"}

EJEMPLOS:

${[...calcExamples, ...intentExamples].join('\n\n')}`;
}

// Cacheamos el system prompt (lee disco solo una vez por proceso)
let cachedSystemPrompt = null;
function getSystemPrompt() {
  if (!cachedSystemPrompt) cachedSystemPrompt = buildSystemPrompt();
  return cachedSystemPrompt;
}

function extractJson(text) {
  // Tolerante a fences de markdown por si el modelo los agrega pese a la instrucción
  const cleaned = String(text).replace(/```(?:json)?/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error(`Respuesta de Gemini sin JSON: ${String(text).slice(0, 200)}`);
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

/**
 * Parsea texto en lenguaje natural. Devuelve un objeto con "intent":
 * - calc: { intent, tipo: ok|ambiguo|error, ... }  (compatible con Sesión 1)
 * - register: { intent, registro } o { intent, tipo: "ambiguo", ... }
 * - query: { intent, consulta: { periodo } }
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
  parsed.intent = parsed.intent || 'calc';
  if (!['calc', 'register', 'query'].includes(parsed.intent)) {
    throw new Error(`Intent inesperado de Gemini: ${parsed.intent}`);
  }
  if (parsed.intent === 'calc' && !['ok', 'ambiguo', 'error'].includes(parsed.tipo)) {
    throw new Error(`Tipo de respuesta inesperado de Gemini: ${parsed.tipo}`);
  }
  return parsed;
}

const RECEIPT_PROMPT = `Eres el lector de tickets de CALC. Recibes la foto de un ticket o recibo de compra (probablemente de México o LatAm: súper, mercado, abarrotes, papelería) y la transcribes a JSON estructurado.

REGLAS:
1. Devuelve SOLO JSON válido, sin markdown.
2. TRANSCRIBE, no calcules: copia los precios y totales tal como aparecen en el ticket. NUNCA "cuadres" ni corrijas números — si el ticket dice algo, eso reportas. La validación la hace otro sistema.
3. NUNCA inventes artículos ni precios. Si un renglón es ilegible, omítelo y agrégalo a "ilegibles" con lo que alcances a leer.
4. "name_canonical": nombre genérico del producto, en minúsculas, normalizado ("ACEITE NUTRIOLI 850ML" → "aceite vegetal 850ml", "JITOMATE SALADET KG" → "jitomate kg").
5. qty: si el ticket muestra peso (kg) usa el peso como qty y el precio por kg como unit_price.
6. Si no encuentras fecha o comercio, usa null.

FORMATO:
{"comercio":"Soriana","fecha":"2026-06-11","moneda":"MXN","items":[{"name_raw":"ACEITE NUTRIOLI 850ML","name_canonical":"aceite vegetal 850ml","qty":1,"unit_price":45.00,"total":45.00}],"total_ticket":800.00,"ilegibles":[]}`;

/**
 * Lee un ticket con Gemini Vision. Devuelve la transcripción estructurada —
 * la validación de cuadre y la confirmación del usuario ocurren después,
 * en código y en el cliente. Aquí NUNCA se guarda nada.
 */
async function parseReceipt(imagenBase64, mimeType = 'image/jpeg') {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      { inlineData: { data: imagenBase64, mimeType } },
      { text: 'Transcribe este ticket al formato JSON indicado.' }
    ],
    config: {
      systemInstruction: RECEIPT_PROMPT,
      responseMimeType: 'application/json',
      temperature: 0
    }
  });

  const parsed = extractJson(response.text);
  if (!Array.isArray(parsed.items)) {
    throw new Error('Gemini Vision no devolvió items del ticket');
  }
  return parsed;
}

module.exports = { parseTexto, parseReceipt, buildSystemPrompt, MODEL };
