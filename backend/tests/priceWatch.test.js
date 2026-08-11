const {
  ejecutar,
  detectarSubidas,
  mensajeBase,
  redactar
} = require('../src/agents/priceWatch');
const { MemoryStore } = require('../src/services/stores/memoryStore');

const HOY = '2026-08-11T09:00:00.000Z';

function historial(nombre, precios) {
  return {
    product_id: nombre,
    name_canonical: nombre,
    purchases: precios.map((unit_price, i) => ({
      unit_price,
      date: `2026-07-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`
    }))
  };
}

describe('vigía de precios — a quién avisa y a quién no', () => {
  test('avisa cuando la subida pasa el umbral y pega en el bolsillo', () => {
    const r = detectarSubidas([historial('azucar', [20, 21, 20, 25])], [], HOY);
    expect(r).toHaveLength(1);
    expect(r[0].producto).toBe('azucar');
    // promedio de las 3 previas [20, 21, 20] = 20.33; 25 sobre eso es +23%
    expect(r[0].promedio_anterior).toBe(20.33);
    expect(r[0].precio_ultimo).toBe(25);
    expect(r[0].diferencia_pct).toBe(23);
    expect(r[0].diferencia_pesos).toBe(4.67);
  });

  test('no molesta por una subida chica en porcentaje', () => {
    expect(detectarSubidas([historial('arroz', [100, 100, 105])], [], HOY)).toHaveLength(0);
  });

  test('no molesta por centavos aunque el porcentaje sea alto', () => {
    // de $2 a $2.60 es +30%, pero son 60 centavos: no vale interrumpir a nadie
    expect(detectarSubidas([historial('chicle', [2, 2, 2.6])], [], HOY)).toHaveLength(0);
  });

  test('con una sola compra previa no inventa tendencia', () => {
    expect(detectarSubidas([historial('nuevo', [20, 40])], [], HOY)).toHaveLength(0);
  });

  test('no repite el mismo aviso dentro de la semana', () => {
    const previos = [
      { producto: 'azucar', created_at: '2026-08-09T09:00:00.000Z' } // 2 días antes
    ];
    expect(detectarSubidas([historial('azucar', [20, 21, 20, 25])], previos, HOY)).toHaveLength(0);
  });

  test('vuelve a avisar cuando ya pasó el silencio', () => {
    const previos = [{ producto: 'azucar', created_at: '2026-07-01T09:00:00.000Z' }];
    expect(detectarSubidas([historial('azucar', [20, 21, 20, 25])], previos, HOY)).toHaveLength(1);
  });

  test('ordena por impacto en pesos, no por porcentaje', () => {
    const r = detectarSubidas(
      [
        historial('cafe', [100, 100, 100, 130]), // +30 pesos, +30%
        historial('sal', [10, 10, 10, 14]) // +4 pesos, +40%
      ],
      [],
      HOY
    );
    expect(r.map((c) => c.producto)).toEqual(['cafe', 'sal']);
  });

  test('una bajada ya no se ignora: se avisa como oportunidad', () => {
    const r = detectarSubidas([historial('aceite', [50, 50, 50, 30])], [], HOY);
    expect(r).toHaveLength(1);
    expect(r[0].direccion).toBe('bajo');
  });
});

describe('vigía de precios — oportunidades (bajadas)', () => {
  test('avisa cuando algo está notoriamente más barato', () => {
    const r = detectarSubidas([historial('aceite', [50, 52, 50, 38])], [], HOY);
    expect(r).toHaveLength(1);
    expect(r[0].direccion).toBe('bajo');
    expect(r[0].diferencia_pct).toBe(25);
    expect(r[0].diferencia_pesos).toBe(12.67); // siempre positivo, la dirección va aparte
  });

  test('el listón de las bajadas es más alto que el de las subidas', () => {
    // -13% sería suficiente para avisar de una subida, no para sugerir comprar
    expect(detectarSubidas([historial('arroz', [100, 100, 100, 87])], [], HOY)).toHaveLength(0);
    expect(detectarSubidas([historial('arroz', [100, 100, 100, 113])], [], HOY)).toHaveLength(1);
  });

  test('el mensaje de bajada sugiere sin ordenar', () => {
    const [c] = detectarSubidas([historial('aceite', [50, 52, 50, 38])], [], HOY);
    const m = mensajeBase(c, 'es');
    expect(m).toMatch(/más barato/);
    expect(m).toMatch(/si te hace falta/);
    expect(m).not.toMatch(/debes|tienes que/i);
  });

  test('a igual impacto, la subida se avisa antes que la bajada', () => {
    const r = detectarSubidas(
      [historial('sube', [100, 100, 100, 120]), historial('baja', [100, 100, 100, 80])],
      [],
      HOY
    );
    expect(r[0].direccion).toBe('subio');
  });
});

describe('vigía de precios — cómo lo dice', () => {
  const candidato = {
    direccion: 'subio',
    producto: 'azucar',
    precio_ultimo: 25,
    promedio_anterior: 20.67,
    diferencia_pct: 21,
    diferencia_pesos: 4.33
  };

  test('el mensaje base informa y no ordena', () => {
    const m = mensajeBase(candidato, 'es');
    expect(m).toMatch(/Azucar/);
    expect(m).toMatch(/21%/);
    expect(m).toMatch(/Considéralo antes de comprar/);
    expect(m).not.toMatch(/no la compres/i);
  });

  test('si Gemini se pone mandón, se usa el mensaje base', async () => {
    const m = await redactar(candidato, 'es', {
      generarTexto: async () => 'El azúcar subió mucho, no la compres hoy.'
    });
    expect(m).toBe(mensajeBase(candidato, 'es'));
  });

  test('si Gemini falla, el aviso sale igual', async () => {
    const m = await redactar(candidato, 'es', {
      generarTexto: async () => {
        throw new Error('503 sin servicio');
      }
    });
    expect(m).toBe(mensajeBase(candidato, 'es'));
  });

  test('si Gemini responde bien, se usa su redacción', async () => {
    const m = await redactar(candidato, 'es', {
      generarTexto: async () => 'El azúcar te está saliendo 21% más cara que antes, tenlo en cuenta.'
    });
    expect(m).toMatch(/21% más cara/);
  });
});

describe('vigía de precios — corrida completa', () => {
  test('recorre a todos los usuarios y deja los avisos guardados', async () => {
    const store = new MemoryStore();
    await store.addPricePoints('rosa', [
      { product_id: 'azucar', name_canonical: 'azucar', unit_price: 20, date: '2026-07-01T10:00:00.000Z' },
      { product_id: 'azucar', name_canonical: 'azucar', unit_price: 21, date: '2026-07-02T10:00:00.000Z' },
      { product_id: 'azucar', name_canonical: 'azucar', unit_price: 30, date: '2026-07-03T10:00:00.000Z' }
    ]);
    await store.addPricePoints('luis', [
      { product_id: 'arroz', name_canonical: 'arroz', unit_price: 40, date: '2026-07-01T10:00:00.000Z' },
      { product_id: 'arroz', name_canonical: 'arroz', unit_price: 40, date: '2026-07-02T10:00:00.000Z' },
      { product_id: 'arroz', name_canonical: 'arroz', unit_price: 41, date: '2026-07-03T10:00:00.000Z' }
    ]);

    const resumen = await ejecutar({ store, ahora: HOY });

    expect(resumen.usuarios_revisados).toBe(2);
    expect(resumen.usuarios_con_aviso).toBe(1);
    expect(resumen.avisos_creados).toBe(1);
    expect(resumen.errores).toBe(0);

    const avisosRosa = await store.getNotices('rosa');
    expect(avisosRosa).toHaveLength(1);
    expect(avisosRosa[0].producto).toBe('azucar');
    expect(avisosRosa[0].leido).toBe(false);
    expect(avisosRosa[0].agente).toBe('price-watch');
    expect(await store.getNotices('luis')).toHaveLength(0);
  });

  test('un usuario que truena no tumba la corrida de los demás', async () => {
    const store = new MemoryStore();
    await store.addPricePoints('bueno', [
      { product_id: 'cafe', name_canonical: 'cafe', unit_price: 100, date: '2026-07-01T10:00:00.000Z' },
      { product_id: 'cafe', name_canonical: 'cafe', unit_price: 100, date: '2026-07-02T10:00:00.000Z' },
      { product_id: 'cafe', name_canonical: 'cafe', unit_price: 140, date: '2026-07-03T10:00:00.000Z' }
    ]);
    store.listUserIds = async () => ['roto', 'bueno'];
    const getAll = store.getAllPriceHistories.bind(store);
    store.getAllPriceHistories = async (uid) => {
      if (uid === 'roto') throw new Error('firestore no responde');
      return getAll(uid);
    };

    const resumen = await ejecutar({ store, ahora: HOY });

    expect(resumen.errores).toBe(1);
    expect(resumen.avisos_creados).toBe(1);
    expect(await store.getNotices('bueno')).toHaveLength(1);
  });
});
