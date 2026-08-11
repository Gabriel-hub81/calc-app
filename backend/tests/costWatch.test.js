const { ejecutar, agregarDia, costoDeUso } = require('../src/agents/costWatch');

const AHORA = '2026-08-11T08:00:00.000Z';
const AYER = '2026-08-10';

/** Store falso con uso por día. */
function storeConUso(porDia) {
  return { getUsage: async (dia) => porDia[dia] || [] };
}

describe('contralor — la cuenta del negocio', () => {
  test('la visión cuesta mucho más que el texto (por eso exige sesión)', () => {
    const texto = costoDeUso({ texto: 10, vision: 0 });
    const vision = costoDeUso({ texto: 0, vision: 10 });
    expect(vision).toBeGreaterThan(texto * 5);
  });

  test('separa a los usuarios con sesión del uso anónimo', () => {
    const d = agregarDia([
      { uid: 'rosa', texto: 10, vision: 1 },
      { uid: 'luis', texto: 5, vision: 0 },
      { uid: 'anon', texto: 40, vision: 0 }
    ]);
    expect(d.usuarios_activos).toBe(2); // anon no es una usuaria
    expect(d.llamadas_texto).toBe(55); // pero su gasto sí se cuenta
    expect(d.costo_anonimo_usd).toBeGreaterThan(0);
  });

  test('calcula el costo mensual por usuaria activa (el número del precio)', async () => {
    const store = storeConUso({ [AYER]: [{ uid: 'rosa', texto: 20, vision: 2 }] });
    const v = await ejecutar({ store, ahora: AHORA });

    // 20 * 0.0004 + 2 * 0.004 = 0.016 USD al día → 0.48 al mes
    expect(v.costo_por_usuario_mes_usd).toBe(0.48);
    expect(v.costo_por_usuario_mes_mxn).toBe(8.64); // ~8.64 pesos al mes
    expect(v.veredicto).toMatch(/Normal/);
  });

  test('un día sin actividad se reporta como tal, sin dividir entre cero', async () => {
    const v = await ejecutar({ store: storeConUso({}), ahora: AHORA });
    expect(v.usuarios_activos).toBe(0);
    expect(v.costo_por_usuario_mes_mxn).toBe(0);
    expect(v.pico).toBe(false);
    expect(v.veredicto).toMatch(/Sin actividad/);
  });
});

describe('contralor — detección de picos', () => {
  const normal = [{ uid: 'rosa', texto: 25, vision: 0 }]; // 0.01 USD/día

  test('un pico real dispara la alarma', async () => {
    const store = storeConUso({
      [AYER]: [{ uid: 'abusador', texto: 200, vision: 200 }], // ~0.88 USD
      '2026-08-09': normal,
      '2026-08-08': normal,
      '2026-08-07': normal
    });
    const v = await ejecutar({ store, ahora: AHORA });
    expect(v.pico).toBe(true);
    expect(v.veredicto).toMatch(/PICO DE GASTO/);
  });

  test('no grita por centavos aunque el múltiplo sea enorme', async () => {
    // pasar de 0.004 a 0.04 USD es 10x, pero son 4 centavos: no es un incendio
    const store = storeConUso({
      [AYER]: [{ uid: 'rosa', texto: 100, vision: 0 }],
      '2026-08-09': [{ uid: 'rosa', texto: 10, vision: 0 }],
      '2026-08-08': [{ uid: 'rosa', texto: 10, vision: 0 }]
    });
    const v = await ejecutar({ store, ahora: AHORA });
    expect(v.pico).toBe(false);
  });

  test('sin días de referencia no inventa un pico', async () => {
    const store = storeConUso({ [AYER]: [{ uid: 'rosa', texto: 5000, vision: 500 }] });
    const v = await ejecutar({ store, ahora: AHORA });
    expect(v.promedio_previo_usd).toBeNull();
    expect(v.pico).toBe(false);
  });

  test('los días muertos no cuentan como referencia', async () => {
    // Si un día vacío contara, el promedio se hundiría y cualquier día normal
    // parecería un pico.
    const store = storeConUso({
      [AYER]: normal,
      '2026-08-09': [],
      '2026-08-08': [],
      '2026-08-07': normal
    });
    const v = await ejecutar({ store, ahora: AHORA });
    expect(v.dias_de_referencia).toBe(1);
    expect(v.pico).toBe(false);
  });
});
