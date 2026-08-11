const path = require('path');
const fs = require('fs');
const os = require('os');

const { ejecutar, elegirCasos } = require('../src/agents/accuracyGuard');

// Casos de juguete: 4 de dinero y 4 normales, con respuesta conocida.
const CASOS = [
  { id: 'd1', input: '15% de 800', expected_result: 120, es_dinero: true },
  { id: 'd2', input: 'el doble de 250', expected_result: 500, es_dinero: true },
  { id: 'd3', input: '3 por 25', expected_result: 75, es_dinero: true },
  { id: 'd4', input: 'la mitad de 90', expected_result: 45, es_dinero: true },
  { id: 'n1', input: '2 mas 2', expected_result: 4 },
  { id: 'n2', input: '10 entre 4', expected_result: 2.5 },
  { id: 'n3', input: '7 por 8', expected_result: 56 },
  { id: 'n4', input: '100 menos 1', expected_result: 99 }
];

let casesPath;
beforeAll(() => {
  casesPath = path.join(os.tmpdir(), `calc-guard-casos-${process.pid}.json`);
  fs.writeFileSync(casesPath, JSON.stringify(CASOS));
});
afterAll(() => {
  fs.existsSync(casesPath) && fs.unlinkSync(casesPath);
});

/** parseTexto falso: responde bien salvo los ids que se le indiquen. */
function motor({ malos = [], caidos = [] } = {}) {
  return async (input) => {
    const c = CASOS.find((x) => x.input === input);
    if (caidos.includes(c.id)) {
      throw new Error('{"error":{"code":503,"message":"high demand","status":"UNAVAILABLE"}}');
    }
    const valor = malos.includes(c.id) ? c.expected_result + 100 : c.expected_result;
    return { intent: 'calc', tipo: 'ok', expresion: String(valor), es_dinero: Boolean(c.es_dinero) };
  };
}

describe('guardián de precisión — el examen', () => {
  test('todo bien: no hay alarma', async () => {
    const v = await ejecutar({ parseTexto: motor(), casesPath, limite: 8, semilla: 0 });
    expect(v.evaluados).toBe(8);
    expect(v.correctos).toBe(8);
    expect(v.degradado).toBe(false);
    expect(v.veredicto).toMatch(/Sin novedad/);
  });

  test('prioriza los casos de dinero en la selección', () => {
    const elegidos = elegirCasos(CASOS, 5, 0);
    expect(elegidos.filter((c) => c.es_dinero)).toHaveLength(4);
  });

  test('un solo fallo en DINERO enciende la alarma, aunque el resto pase', async () => {
    const v = await ejecutar({ parseTexto: motor({ malos: ['d1'] }), casesPath, limite: 8, semilla: 0 });
    expect(v.fallos_dinero).toBe(1);
    expect(v.acierto_pct).toBe(87.5); // arriba del 90 no llega, pero da igual:
    expect(v.degradado).toBe(true); // en dinero la meta es CERO
    expect(v.veredicto).toMatch(/DINERO/);
  });

  test('un fallo aislado fuera de dinero no dispara la alarma', async () => {
    // 10 casos sin dinero, todos con texto distinto: 1 fallo = 90% de acierto,
    // justo en el umbral. Sin errores de dinero, no hay alarma.
    const soloNormales = Array.from({ length: 10 }, (_, i) => ({
      id: `x${i}`,
      input: `caso numero ${i}`,
      expected_result: i + 1
    }));
    const p = path.join(os.tmpdir(), `calc-guard-n-${process.pid}.json`);
    fs.writeFileSync(p, JSON.stringify(soloNormales));

    const parse = async (input) => {
      const c = soloNormales.find((x) => x.input === input);
      const valor = c.id === 'x0' ? c.expected_result + 100 : c.expected_result;
      return { intent: 'calc', tipo: 'ok', expresion: String(valor) };
    };
    const v = await ejecutar({ parseTexto: parse, casesPath: p, limite: 10, semilla: 0 });
    fs.unlinkSync(p);

    expect(v.fallos).toBe(1);
    expect(v.fallos_dinero).toBe(0);
    expect(v.acierto_pct).toBe(90);
    expect(v.degradado).toBe(false);
  });
});

describe('guardián de precisión — no despertar a nadie por gusto', () => {
  test('si la API se cae, NO dice degradado: dice que no pudo evaluar', async () => {
    const v = await ejecutar({
      parseTexto: motor({ caidos: ['d1', 'd2', 'd3', 'd4', 'n1', 'n2', 'n3'] }),
      casesPath,
      limite: 8,
      semilla: 0
    });
    expect(v.sin_respuesta).toBe(7);
    expect(v.evaluable).toBe(false);
    expect(v.degradado).toBe(false);
    expect(v.veredicto).toMatch(/No pude evaluar/);
  });

  test('caídas parciales no contaminan el porcentaje de acierto', async () => {
    const v = await ejecutar({ parseTexto: motor({ caidos: ['n1', 'n2'] }), casesPath, limite: 8, semilla: 0 });
    expect(v.evaluados).toBe(6);
    expect(v.correctos).toBe(6);
    expect(v.acierto_pct).toBe(100);
    expect(v.degradado).toBe(false);
  });

  test('caída total tampoco es alarma de precisión', async () => {
    const v = await ejecutar({
      parseTexto: async () => {
        throw new Error('500 Internal error');
      },
      casesPath,
      limite: 8,
      semilla: 0
    });
    expect(v.evaluados).toBe(0);
    expect(v.degradado).toBe(false);
    expect(v.evaluable).toBe(false);
  });

  test('el veredicto trae el detalle de qué falló, para poder arreglarlo', async () => {
    const v = await ejecutar({ parseTexto: motor({ malos: ['d2'] }), casesPath, limite: 8, semilla: 0 });
    expect(v.detalle_fallos[0]).toMatchObject({ id: 'd2', esperado: 500, obtenido: 600 });
  });
});
