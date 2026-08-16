const {
  ejecutar,
  recolectar,
  mejorOportunidad,
  mensajeBase,
  redactar
} = require('../src/agents/marketWatch');
const { MemoryStore } = require('../src/services/stores/memoryStore');

const IZTAPALAPA = 'Central de Abasto de Iztapalapa';
const AHORA = '2026-08-15T13:00:00.000Z';

/** Tabla de SNIIM con `n` días de referencia a un precio y 7 días a otro. */
function tablaHtml({ dias = 21, precioViejo = 20, precioNuevo = 20 }) {
  const filas = Array.from({ length: dias }, (_, i) => {
    const fecha = new Date(Date.UTC(2026, 6, 20 + i));
    const dd = String(fecha.getUTCDate()).padStart(2, '0');
    const mm = String(fecha.getUTCMonth() + 1).padStart(2, '0');
    const precio = i >= dias - 7 ? precioNuevo : precioViejo;
    return `<tr>
      <td class="Datos2">${dd}/${mm}/${fecha.getUTCFullYear()}</td>
      <td class="Datos2">Kilogramo</td><td class="Datos2">Sinaloa</td>
      <td class="Datos2">${precio - 1}</td><td class="Datos2">${precio + 1}</td>
      <td class="Datos2">${precio}</td></tr>`;
  }).join('');
  return `<table id="tblResultados">${filas}</table>`;
}

/** fetch falso: devuelve la misma tabla para cualquier producto. */
const fetchQueDevuelve = (html) => async () => ({ ok: true, text: async () => html });

const UN_PRODUCTO = [{ clave: 'jitomate', sniim_id: '839', sniim_nombre: 'Tomate Saladette' }];

describe('market-watch — escoger la oportunidad', () => {
  test('se queda con la baja más grande', () => {
    const op = mejorOportunidad([
      { clave: 'cebolla', variacion_pct: -16, precio_actual: 12 },
      { clave: 'jitomate', variacion_pct: -31, precio_actual: 14 },
      { clave: 'papa', variacion_pct: -22, precio_actual: 18 }
    ]);
    expect(op.clave).toBe('jitomate');
  });

  test('se calla cuando nada baja lo suficiente', () => {
    // Es lo que va a pasar la mayoría de los días, y está bien: un agente que
    // avisa diario se ignora en una semana.
    expect(
      mejorOportunidad([
        { clave: 'cebolla', variacion_pct: -9, precio_actual: 12 },
        { clave: 'papa', variacion_pct: 40, precio_actual: 30 }
      ])
    ).toBeNull();
    expect(mejorOportunidad([])).toBeNull();
  });

  test('una subida nunca se presenta como oportunidad', () => {
    expect(mejorOportunidad([{ clave: 'limón', variacion_pct: 65, precio_actual: 60 }])).toBeNull();
  });
});

describe('market-watch — cómo se dice', () => {
  const op = { clave: 'jitomate', precio_actual: 14.4, precio_referencia: 19.2, variacion_pct: -25 };

  test('el mensaje nombra la central y aclara que no es precio de tienda', () => {
    // Sin esto CALC parece prometer $14.40 en el Chedraui. Una sola mentira
    // comprobable tira la confianza de todo lo demás.
    const m = mensajeBase(op, IZTAPALAPA);
    expect(m).toContain(IZTAPALAPA);
    expect(m).toMatch(/no es (precio )?de tienda|precio de central/i);
    expect(m).toContain('25');
  });

  test('concuerda el género: la papa bajó, no "papa está más barato"', () => {
    // CALC habla español mexicano de verdad. Una concordancia mal hecha lo
    // delata como robot en la primera frase.
    const papa = { clave: 'papa', articulo: 'la', precio_actual: 24.71, precio_referencia: 32.78, variacion_pct: -24.6 };
    expect(mensajeBase(papa, IZTAPALAPA)).toContain('la papa bajó');
    expect(mensajeBase(op, IZTAPALAPA)).toContain('el jitomate bajó');
    expect(mensajeBase(papa, IZTAPALAPA)).not.toMatch(/más barato/);
  });

  test('todo el catálogo trae artículo', () => {
    const { PRODUCTOS } = require('../src/data/sniimProductos');
    for (const p of PRODUCTOS) expect(['el', 'la']).toContain(p.articulo);
  });

  test('si Gemini borra el nombre de la central, se usa el mensaje base', async () => {
    const texto = await redactar(op, IZTAPALAPA, 'es', {
      generarTexto: async () => 'El jitomate está baratísimo esta semana, aprovecha.'
    });
    expect(texto).toBe(mensajeBase(op, IZTAPALAPA));
  });

  test('si Gemini da una orden, se usa el mensaje base', async () => {
    const texto = await redactar(op, IZTAPALAPA, 'es', {
      generarTexto: async () => `Tienes que comprar jitomate en ${IZTAPALAPA} hoy mismo.`
    });
    expect(texto).toBe(mensajeBase(op, IZTAPALAPA));
  });

  test('si Gemini truena, el aviso sale igual', async () => {
    const texto = await redactar(op, IZTAPALAPA, 'es', {
      generarTexto: async () => {
        throw new Error('429 quota');
      }
    });
    expect(texto).toBe(mensajeBase(op, IZTAPALAPA));
  });

  test('acepta la redacción del modelo cuando cumple las reglas', async () => {
    const bueno = `El jitomate anda 25% más barato en ${IZTAPALAPA}: $19.20 a $14.40 el kilo al mayoreo, no en tienda.`;
    const texto = await redactar(op, IZTAPALAPA, 'es', { generarTexto: async () => bueno });
    expect(texto).toBe(bueno);
  });
});

describe('market-watch — recolectar', () => {
  test('un producto que falla no tumba la corrida', async () => {
    let llamada = 0;
    const foto = await recolectar({
      ahora: AHORA,
      pausaMs: 0,
      productos: [
        { clave: 'jitomate', sniim_id: '839', sniim_nombre: 'Tomate Saladette' },
        { clave: 'cebolla', sniim_id: '183', sniim_nombre: 'Cebolla Bola' }
      ],
      fetchImpl: async () => {
        llamada += 1;
        if (llamada === 1) throw new Error('ECONNRESET');
        return { ok: true, text: async () => tablaHtml({ precioViejo: 20, precioNuevo: 15 }) };
      }
    });
    expect(foto.fallos).toHaveLength(1);
    expect(foto.productos.map((p) => p.clave)).toEqual(['cebolla']);
    expect(foto.mercado_nombre).toBe(IZTAPALAPA);
  });
});

describe('market-watch — corrida completa', () => {
  test('guarda la foto del día y deja un aviso por usuaria', async () => {
    const store = new MemoryStore();
    await store.addEntry('uid-guadalupe', { created_at: AHORA });
    await store.addEntry('uid-ramiro', { created_at: AHORA });

    const resumen = await ejecutar({
      store,
      ahora: AHORA,
      pausaMs: 0,
      productos: UN_PRODUCTO,
      fetchImpl: fetchQueDevuelve(tablaHtml({ precioViejo: 20, precioNuevo: 14 })),
      generarTexto: undefined
    });

    expect(resumen.oportunidad.producto).toBe('jitomate');
    expect(resumen.oportunidad.variacion_pct).toBe(-30);
    expect(resumen.avisos_creados).toBe(2);

    const cache = await store.getMarketPrices('100', '2026-08-15');
    expect(cache.mercado_nombre).toBe(IZTAPALAPA);
    expect(cache.productos[0].clave).toBe('jitomate');
    expect(cache.fuente).toMatch(/SNIIM/);

    const [aviso] = await store.getNotices('uid-guadalupe');
    expect(aviso.agente).toBe('market-watch');
    expect(aviso.mensaje).toContain(IZTAPALAPA);
    expect(aviso.leido).toBe(false);
  });

  test('el aviso sirve el día uno, sin historial de compras', async () => {
    // Esta es la razón de existir del agente: price-watch necesita 3 compras
    // del mismo producto; este no necesita ninguna.
    const store = new MemoryStore();
    await store.addEntry('uid-nueva', { created_at: AHORA });
    expect(await store.getAllPriceHistories('uid-nueva')).toEqual([]);

    const resumen = await ejecutar({
      store,
      ahora: AHORA,
      pausaMs: 0,
      productos: UN_PRODUCTO,
      fetchImpl: fetchQueDevuelve(tablaHtml({ precioViejo: 20, precioNuevo: 14 }))
    });
    expect(resumen.avisos_creados).toBe(1);
  });

  test('no repite el mismo producto dentro de la semana', async () => {
    const store = new MemoryStore();
    await store.addEntry('uid-1', { created_at: AHORA });
    const fetchImpl = fetchQueDevuelve(tablaHtml({ precioViejo: 20, precioNuevo: 14 }));

    await ejecutar({ store, ahora: AHORA, pausaMs: 0, productos: UN_PRODUCTO, fetchImpl });
    const alDiaSiguiente = await ejecutar({
      store,
      ahora: '2026-08-16T13:00:00.000Z',
      pausaMs: 0,
      productos: UN_PRODUCTO,
      fetchImpl
    });

    expect(alDiaSiguiente.oportunidad.producto).toBe('jitomate');
    expect(alDiaSiguiente.avisos_creados).toBe(0);
    expect(await store.getNotices('uid-1')).toHaveLength(1);
  });

  test('guarda la caché aunque no haya nada que avisar', async () => {
    const store = new MemoryStore();
    await store.addEntry('uid-1', { created_at: AHORA });

    const resumen = await ejecutar({
      store,
      ahora: AHORA,
      pausaMs: 0,
      productos: UN_PRODUCTO,
      fetchImpl: fetchQueDevuelve(tablaHtml({ precioViejo: 20, precioNuevo: 19 }))
    });

    expect(resumen.oportunidad).toBeNull();
    expect(resumen.avisos_creados).toBe(0);
    expect((await store.getMarketPrices('100', '2026-08-15')).productos).toHaveLength(1);
  });

  test('si SNIIM se cae, conserva la foto de ayer en vez de pisarla con una vacía', async () => {
    const store = new MemoryStore();
    await store.addEntry('uid-1', { created_at: AHORA });
    await ejecutar({
      store,
      ahora: '2026-08-14T13:00:00.000Z',
      pausaMs: 0,
      productos: UN_PRODUCTO,
      fetchImpl: fetchQueDevuelve(tablaHtml({ precioViejo: 20, precioNuevo: 19 }))
    });

    const resumen = await ejecutar({
      store,
      ahora: AHORA,
      pausaMs: 0,
      productos: UN_PRODUCTO,
      fetchImpl: async () => ({ ok: false, status: 503 })
    });

    expect(resumen.productos_con_datos).toBe(0);
    expect(resumen.nota).toMatch(/caché anterior/);
    expect(await store.getMarketPrices('100', '2026-08-15')).toBeNull();
    // La app sigue teniendo qué contestar: lo de ayer.
    const ultima = await store.getLatestMarketPrices('100');
    expect(ultima.fecha).toBe('2026-08-14');
  });
});
