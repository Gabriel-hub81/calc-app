#!/usr/bin/env node
/**
 * Punto de entrada de los agentes. Corre como Cloud Run Job disparado por
 * Cloud Scheduler: sin laptop, sin sesión abierta, con reintentos y con los
 * logs de ejecución guardados en Cloud Logging.
 *
 *   node src/agents/run.js price-watch
 *
 * El resumen se imprime como JSON en una sola línea para que quede consultable
 * en los registros ("qué hizo CALC mientras dormías").
 */
require('dotenv').config();

const { getStore } = require('../services/store');
const priceWatch = require('./priceWatch');
const accuracyGuard = require('./accuracyGuard');
const dailyClose = require('./dailyClose');
const costWatch = require('./costWatch');

/** Adaptador de texto libre para los agentes (NUNCA para aritmética). */
async function generarTexto(prompt) {
  const { GoogleGenAI } = require('@google/genai');
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY no configurada');
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const res = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
    contents: prompt,
    config: { temperature: 0.4 }
  });
  return res.text;
}

const AGENTES = {
  'price-watch': () => priceWatch.ejecutar({ store: getStore(), generarTexto }),
  'daily-close': () => dailyClose.ejecutar({ store: getStore(), generarTexto }),
  'cost-watch': async () => {
    const veredicto = await costWatch.ejecutar({ store: getStore() });
    // Un pico de gasto falla el job → llega el correo de alerta. El costo por
    // usuaria se reporta siempre, sea alto o bajo: es información, no alarma.
    if (veredicto.pico) {
      console.error(JSON.stringify(veredicto));
      throw new Error(veredicto.veredicto);
    }
    return veredicto;
  },
  'accuracy-guard': async () => {
    const { parseTexto } = require('../services/gemini');
    const veredicto = await accuracyGuard.ejecutar({ parseTexto });
    // Degradación = job fallido a propósito: Cloud Run lo marca en rojo y la
    // alerta llega sola. "No pude evaluar" NO enciende la alarma.
    if (veredicto.degradado) {
      console.error(JSON.stringify(veredicto));
      const err = new Error(veredicto.veredicto);
      err.veredicto = veredicto;
      throw err;
    }
    return veredicto;
  }
};

async function main() {
  const nombre = process.argv[2];
  const agente = AGENTES[nombre];
  if (!agente) {
    console.error(`Agente desconocido: ${nombre}. Disponibles: ${Object.keys(AGENTES).join(', ')}`);
    process.exit(2);
  }

  try {
    const resumen = await agente();
    console.log(JSON.stringify(resumen));
    process.exit(0);
  } catch (err) {
    // Falla ruidosa a propósito: un agente que muere en silencio es peor que
    // no tenerlo — Cloud Run marca el job como fallido y queda en los logs.
    console.error(JSON.stringify({ agente: nombre, error: err.message, stack: err.stack }));
    process.exit(1);
  }
}

main();
