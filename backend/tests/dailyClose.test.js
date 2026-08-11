const { ejecutar, calcularCierre, mensajeBase, redactar } = require('../src/agents/dailyClose');
const { MemoryStore } = require('../src/services/stores/memoryStore');

const AHORA = '2026-08-11T23:00:00.000Z';

const venta = (monto, fecha, ganancia) => ({
  type: 'sale',
  amount_total: monto,
  ganancia,
  items: [],
  created_at: fecha
});
const gasto = (monto, fecha) => ({
  type: 'expense',
  amount_total: monto,
  items: [],
  created_at: fecha
});

describe('cierre del día — qué cuenta y qué no', () => {
  test('suma ventas y gastos de hoy y saca el balance', () => {
    const c = calcularCierre(
      [venta(500, '2026-08-11T14:00:00.000Z'), gasto(120, '2026-08-11T16:00:00.000Z')],
      AHORA
    );
    expect(c.ventas).toBe(500);
    expect(c.gastos).toBe(120);
    expect(c.balance).toBe(380);
    expect(c.movimientos).toBe(2);
  });

  test('un día sin movimiento no genera cierre (nada de ruido diario)', () => {
    expect(calcularCierre([], AHORA)).toBeNull();
    expect(calcularCierre([venta(300, '2026-08-05T14:00:00.000Z')], AHORA)).toBeNull();
  });

  test('no mezcla los movimientos de días anteriores en el total de hoy', () => {
    const c = calcularCierre(
      [venta(1000, '2026-08-10T14:00:00.000Z'), venta(200, '2026-08-11T14:00:00.000Z')],
      AHORA
    );
    expect(c.ventas).toBe(200);
  });

  test('compara contra días CON movimiento, no contra días cerrados', () => {
    const c = calcularCierre(
      [
        venta(100, '2026-08-09T14:00:00.000Z'), // día con movimiento
        venta(300, '2026-08-10T14:00:00.000Z'), // día con movimiento
        venta(400, '2026-08-11T14:00:00.000Z') // hoy
      ],
      AHORA
    );
    // promedio de días previos con movimiento = (100 + 300) / 2 = 200
    expect(c.comparacion.promedio_dias_previos).toBe(200);
    expect(c.comparacion.dias_comparados).toBe(2);
    expect(c.comparacion.diferencia_pct).toBe(100);
  });

  test('sin días previos con movimiento, no inventa comparación', () => {
    const c = calcularCierre([venta(400, '2026-08-11T14:00:00.000Z')], AHORA);
    expect(c.comparacion).toBeNull();
  });
});

describe('cierre del día — cómo lo dice', () => {
  const cierre = { ventas: 500, gastos: 120, balance: 380, movimientos: 2, comparacion: null };

  test('el mensaje base dice ventas, gastos y lo que queda', () => {
    const m = mensajeBase(cierre);
    expect(m).toMatch(/\$500\.00/);
    expect(m).toMatch(/\$120\.00/);
    expect(m).toMatch(/\$380\.00/);
  });

  test('menciona la comparación solo si es notoria', () => {
    const conPoco = mensajeBase({ ...cierre, comparacion: { diferencia_pct: 3, dias_comparados: 4 } });
    expect(conPoco).not.toMatch(/más que|menos que/);

    const conMucho = mensajeBase({ ...cierre, comparacion: { diferencia_pct: 45, dias_comparados: 4 } });
    expect(conMucho).toMatch(/45% más/);
  });

  test('si Gemini juzga a la persona, se usa el mensaje base', async () => {
    const m = await redactar(cierre, {
      generarTexto: async () => 'Vendiste poco, deberías esforzarte más mañana.'
    });
    expect(m).toBe(mensajeBase(cierre));
  });

  test('si Gemini falla, el cierre sale igual', async () => {
    const m = await redactar(cierre, {
      generarTexto: async () => {
        throw new Error('503');
      }
    });
    expect(m).toBe(mensajeBase(cierre));
  });
});

describe('cierre del día — corrida completa', () => {
  test('deja el cierre guardado solo a quien tuvo movimiento', async () => {
    const store = new MemoryStore();
    await store.addEntry('rosa', venta(500, '2026-08-11T14:00:00.000Z'));
    await store.addEntry('rosa', gasto(120, '2026-08-11T16:00:00.000Z'));
    await store.addEntry('luis', venta(900, '2026-08-04T14:00:00.000Z')); // semana pasada

    const resumen = await ejecutar({ store, ahora: AHORA });

    expect(resumen.usuarios_revisados).toBe(2);
    expect(resumen.cierres_creados).toBe(1);
    expect(resumen.dias_sin_movimiento).toBe(1);
    expect(resumen.errores).toBe(0);

    const avisos = await store.getNotices('rosa');
    expect(avisos).toHaveLength(1);
    expect(avisos[0].tipo).toBe('cierre_dia');
    expect(avisos[0].balance).toBe(380);
    expect(await store.getNotices('luis')).toHaveLength(0);
  });

  test('un usuario que truena no tumba a los demás', async () => {
    const store = new MemoryStore();
    await store.addEntry('bueno', venta(200, '2026-08-11T14:00:00.000Z'));
    store.listUserIds = async () => ['roto', 'bueno'];
    const orig = store.getEntries.bind(store);
    store.getEntries = async (uid, r) => {
      if (uid === 'roto') throw new Error('firestore caído');
      return orig(uid, r);
    };

    const resumen = await ejecutar({ store, ahora: AHORA });
    expect(resumen.errores).toBe(1);
    expect(resumen.cierres_creados).toBe(1);
  });
});
