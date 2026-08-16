const fs = require('fs');
const path = require('path');
const { parseTabla, porDia, resumir, consultar, aFechaMx, aFechaIso, SniimError } =
  require('../src/services/sniim');

// Respuesta REAL de SNIIM guardada el 13 de agosto de 2026: tomate saladette
// en la Central de Abasto de Iztapalapa, del 1 de julio al 13 de agosto.
// Se prueba contra el HTML de verdad, no contra uno inventado: el valor de
// esta prueba es avisar el día que el gobierno cambie el diseño de la página.
const HTML_REAL = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'sniim-tomate-iztapalapa.html'),
  'utf8'
);

describe('sniim — lectura de la tabla', () => {
  test('extrae los renglones de precios de una respuesta real', () => {
    const filas = parseTabla(HTML_REAL);
    expect(filas.length).toBeGreaterThan(50);

    for (const f of filas) {
      expect(f.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(f.precio_frecuente).toBeGreaterThan(0);
      expect(typeof f.origen).toBe('string');
    }
  });

  test('el precio frecuente cae entre el mínimo y el máximo', () => {
    // Si esto falla, se movieron las columnas: estaríamos leyendo el precio
    // equivocado y todos los avisos saldrían con números falsos.
    for (const f of parseTabla(HTML_REAL)) {
      expect(f.precio_frecuente).toBeGreaterThanOrEqual(f.precio_min);
      expect(f.precio_frecuente).toBeLessThanOrEqual(f.precio_max);
    }
  });

  test('ante HTML inesperado devuelve vacío en vez de reventar', () => {
    expect(parseTabla('<html><body>Sitio en mantenimiento</body></html>')).toEqual([]);
    expect(parseTabla('')).toEqual([]);
    expect(parseTabla(null)).toEqual([]);
    expect(parseTabla('<table id="tblResultados"><tr><td>basura</td></tr></table>')).toEqual([]);
  });

  test('ignora renglones sin precio en vez de guardarlos en cero', () => {
    const html = `<table id="tblResultados">
      <tr><td class="Datos2">01/08/2026</td><td class="Datos2">Caja</td><td class="Datos2">Puebla</td>
          <td class="Datos2">10.00</td><td class="Datos2">14.00</td><td class="Datos2">12.00</td></tr>
      <tr><td class="Datos2">02/08/2026</td><td class="Datos2">Caja</td><td class="Datos2">Puebla</td>
          <td class="Datos2"></td><td class="Datos2"></td><td class="Datos2"></td></tr>
    </table>`;
    const filas = parseTabla(html);
    expect(filas).toHaveLength(1);
    expect(filas[0].precio_frecuente).toBe(12);
  });
});

describe('sniim — un precio por día', () => {
  test('promedia los distintos orígenes del mismo día', () => {
    const dias = porDia([
      { fecha: '2026-08-10', precio_frecuente: 10 },
      { fecha: '2026-08-10', precio_frecuente: 20 },
      { fecha: '2026-08-11', precio_frecuente: 15 }
    ]);
    expect(dias).toEqual([
      { fecha: '2026-08-10', precio: 15, observaciones: 2 },
      { fecha: '2026-08-11', precio: 15, observaciones: 1 }
    ]);
  });

  test('devuelve los días ordenados aunque lleguen revueltos', () => {
    const dias = porDia([
      { fecha: '2026-08-12', precio_frecuente: 9 },
      { fecha: '2026-08-01', precio_frecuente: 9 }
    ]);
    expect(dias.map((d) => d.fecha)).toEqual(['2026-08-01', '2026-08-12']);
  });
});

describe('sniim — resumen para el vigía', () => {
  /** n días consecutivos a un precio fijo. */
  const serie = (n, precio, desdeDia = 1) =>
    Array.from({ length: n }, (_, i) => ({
      fecha: `2026-08-${String(desdeDia + i).padStart(2, '0')}`,
      precio_frecuente: precio
    }));

  test('detecta una baja real contra las semanas previas', () => {
    // 14 días a $20, luego 7 días a $15 → la semana está 25% más barata
    const r = resumir([...serie(14, 20, 1), ...serie(7, 15, 15)]);
    expect(r.precio_actual).toBe(15);
    expect(r.precio_referencia).toBe(20);
    expect(r.variacion_pct).toBe(-25);
    expect(r.dias_recientes).toBe(7);
    expect(r.fecha_ultima).toBe('2026-08-21');
  });

  test('con pocos días se calla en vez de inventar una tendencia', () => {
    // Un porcentaje sacado de tres días no es información, es ruido.
    expect(resumir(serie(3, 20))).toBeNull();
    expect(resumir(serie(9, 20))).toBeNull();
    expect(resumir([])).toBeNull();
  });

  test('funciona sobre datos reales de la central de abasto', () => {
    const r = resumir(parseTabla(HTML_REAL));
    expect(r).not.toBeNull();
    expect(r.precio_actual).toBeGreaterThan(0);
    expect(r.precio_referencia).toBeGreaterThan(0);
    // Rango de cordura: mayoreo de jitomate por kilo. Si sale $500, estamos
    // leyendo la columna equivocada o el precio por caja en vez de por kilo.
    expect(r.precio_actual).toBeLessThan(100);
    expect(Number.isFinite(r.variacion_pct)).toBe(true);
  });
});

describe('sniim — fechas y red', () => {
  test('traduce fechas en ambos sentidos', () => {
    expect(aFechaMx(new Date('2026-08-13T00:00:00Z'))).toBe('13/08/2026');
    expect(aFechaIso('13/08/2026')).toBe('2026-08-13');
    expect(aFechaIso('no es fecha')).toBeNull();
  });

  test('manda el User-Agent de navegador (sin él SNIIM responde 503)', async () => {
    let recibido = null;
    await consultar({
      productoId: '839',
      mercadoId: '100',
      desde: new Date('2026-07-01T00:00:00Z'),
      hasta: new Date('2026-08-13T00:00:00Z'),
      fetchImpl: async (url, opts) => {
        recibido = { url, opts };
        return { ok: true, text: async () => HTML_REAL };
      }
    });
    expect(recibido.opts.headers['User-Agent']).toMatch(/Mozilla/);
    expect(recibido.url).toContain('fechaInicio=01%2F07%2F2026');
    expect(recibido.url).toContain('ProductoId=839');
    expect(recibido.url).toContain('DestinoId=100');
    // Por kilogramo, no por "arpilla de 30 kg"
    expect(recibido.url).toContain('PreciosPorId=2');
  });

  test('un error de SNIIM se reporta, no se disfraza de datos vacíos', async () => {
    await expect(
      consultar({
        productoId: '839',
        mercadoId: '100',
        desde: new Date('2026-07-01T00:00:00Z'),
        hasta: new Date('2026-08-13T00:00:00Z'),
        fetchImpl: async () => ({ ok: false, status: 503 })
      })
    ).rejects.toThrow(SniimError);
  });

  test('la red caída también se reporta como SniimError', async () => {
    await expect(
      consultar({
        productoId: '839',
        mercadoId: '100',
        desde: new Date('2026-07-01T00:00:00Z'),
        hasta: new Date('2026-08-13T00:00:00Z'),
        fetchImpl: async () => {
          throw new Error('ECONNRESET');
        }
      })
    ).rejects.toThrow(/No se pudo consultar SNIIM/);
  });
});
