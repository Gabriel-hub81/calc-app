// Patrones reales observados en la corrida de accuracy del 2026-07-13:
// con el servicio degradado, Gemini a veces concatena el objeto dos veces
// o lo devuelve truncado. Truncado NUNCA se repara — se rechaza (y el
// caller reintenta): con dinero, adivinar está prohibido.
const { extractJson } = require('../src/services/gemini');

describe('extractJson', () => {
  const obj = { intent: 'calc', tipo: 'ok', expresion: '0.15 * 800', es_dinero: true };

  test('objeto simple', () => {
    expect(extractJson(JSON.stringify(obj))).toEqual(obj);
  });

  test('con fences de markdown', () => {
    expect(extractJson('```json\n' + JSON.stringify(obj) + '\n```')).toEqual(obj);
  });

  test('dos objetos concatenados → toma el primero', () => {
    const doble = JSON.stringify(obj) + '\n' + JSON.stringify({ intent: 'calc', tipo: 'error' });
    expect(extractJson(doble)).toEqual(obj);
  });

  test('objeto pretty-printed duplicado (caso real de la corrida)', () => {
    const pretty = JSON.stringify(obj, null, 2);
    expect(extractJson(pretty + '\n' + pretty)).toEqual(obj);
  });

  test('llaves dentro de strings no confunden el balanceo', () => {
    const conLlaves = { mensaje: '¿Quisiste decir {esto} o {aquello}?', tipo: 'ambiguo' };
    expect(extractJson(JSON.stringify(conLlaves) + JSON.stringify(obj))).toEqual(conLlaves);
  });

  test('comillas escapadas dentro de strings', () => {
    const conEscapes = { mensaje: 'dijo \\"hola\\" y {chao}'.replace(/\\\\/g, '\\'), tipo: 'ambiguo' };
    const raw = JSON.stringify(conEscapes);
    expect(extractJson(raw)).toEqual(conEscapes);
  });

  test('JSON truncado → lanza (no se adivina)', () => {
    const truncado = JSON.stringify(obj).slice(0, 25);
    expect(() => extractJson(truncado)).toThrow(/truncado/);
  });

  test('sin JSON → lanza', () => {
    expect(() => extractJson('no hay nada estructurado aquí')).toThrow(/sin JSON/);
  });

  test('JSON corrupto a medias → lanza SyntaxError, nunca objeto parcial', () => {
    const corrupto = '{"intent":"calc","expresion":"0.15 * 800",,"tipo":"ok"}';
    expect(() => extractJson(corrupto)).toThrow();
  });
});
