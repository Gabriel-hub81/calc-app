const { compararOpciones, ComparacionError, normalizarUnidad } = require('../src/services/comparador');

describe('comparador — ¿cuál me conviene?', () => {
  test('el caso del arroz: la presentación grande NO siempre conviene', () => {
    const r = compararOpciones(
      [
        { etiqueta: 'la bolsa de 2 kg', precio: 245, cantidad: 2, unidad: 'kg' },
        { etiqueta: 'la bolsa de 6.81 kg', precio: 1050, cantidad: 6.81, unidad: 'kg' }
      ],
      'es'
    );

    expect(r.mejor).toBe('la bolsa de 2 kg');
    expect(r.opciones[0].precio_unitario).toBe(122.5);
    expect(r.opciones[1].precio_unitario).toBe(154.19);
    expect(r.ahorro_por_unidad).toBe(31.69);
    expect(r.mensaje).toMatch(/2 kg/);
    expect(r.mensaje).toMatch(/122\.50/);
  });

  test('normaliza gramos contra kilos antes de comparar', () => {
    const r = compararOpciones(
      [
        { etiqueta: 'la bolsita de 500 g', precio: 30, cantidad: 500, unidad: 'g' },
        { etiqueta: 'la bolsa de 2 kg', precio: 100, cantidad: 2, unidad: 'kg' }
      ],
      'es'
    );

    // 500 g a $30 = $60/kg; 2 kg a $100 = $50/kg → gana la grande
    expect(r.mejor).toBe('la bolsa de 2 kg');
    expect(r.opciones[0].precio_unitario).toBe(60);
    expect(r.opciones[1].precio_unitario).toBe(50);
    expect(r.unidad).toBe('kg');
  });

  test('mililitros contra litros', () => {
    const r = compararOpciones(
      [
        { etiqueta: 'la de 750 ml', precio: 45, cantidad: 750, unidad: 'ml' },
        { etiqueta: 'la de 3 litros', precio: 165, cantidad: 3, unidad: 'l' }
      ],
      'es'
    );
    expect(r.mejor).toBe('la de 3 litros');
    expect(r.opciones[0].precio_unitario).toBe(60);
    expect(r.opciones[1].precio_unitario).toBe(55);
  });

  test('empate: se dice que da igual, no se inventa un ganador', () => {
    const r = compararOpciones(
      [
        { etiqueta: 'la de 1 kg', precio: 50, cantidad: 1, unidad: 'kg' },
        { etiqueta: 'la de 2 kg', precio: 100, cantidad: 2, unidad: 'kg' }
      ],
      'es'
    );
    expect(r.ahorro_por_unidad).toBeUndefined();
    expect(r.mensaje).toMatch(/lo mismo|igual/i);
  });

  test('no compara peras con manzanas (kg contra litros)', () => {
    expect(() =>
      compararOpciones(
        [
          { etiqueta: 'la de 1 kg', precio: 50, cantidad: 1, unidad: 'kg' },
          { etiqueta: 'la de 1 litro', precio: 40, cantidad: 1, unidad: 'l' }
        ],
        'es'
      )
    ).toThrow(ComparacionError);
  });

  test('una sola opción no es comparación', () => {
    expect(() =>
      compararOpciones([{ etiqueta: 'la de 1 kg', precio: 50, cantidad: 1, unidad: 'kg' }], 'es')
    ).toThrow(ComparacionError);
  });

  test('contenido cero o inválido no divide entre cero: error amable', () => {
    expect(() =>
      compararOpciones(
        [
          { etiqueta: 'la chica', precio: 50, cantidad: 0, unidad: 'kg' },
          { etiqueta: 'la grande', precio: 90, cantidad: 2, unidad: 'kg' }
        ],
        'es'
      )
    ).toThrow(ComparacionError);
  });

  test('tres opciones: elige la mejor de todas', () => {
    const r = compararOpciones(
      [
        { etiqueta: 'la de 1 kg', precio: 60, cantidad: 1, unidad: 'kg' },
        { etiqueta: 'la de 5 kg', precio: 240, cantidad: 5, unidad: 'kg' },
        { etiqueta: 'la de 3 kg', precio: 165, cantidad: 3, unidad: 'kg' }
      ],
      'es'
    );
    expect(r.mejor).toBe('la de 5 kg'); // 48/kg vs 60 y 55
  });

  test('responde en inglés cuando el idioma es en', () => {
    const r = compararOpciones(
      [
        { etiqueta: 'the 2 kg bag', precio: 245, cantidad: 2, unidad: 'kg' },
        { etiqueta: 'the 6.81 kg bag', precio: 1050, cantidad: 6.81, unidad: 'kg' }
      ],
      'en'
    );
    expect(r.mensaje).toMatch(/Go with|per kg/);
  });

  test('unidades desconocidas se respetan tal cual', () => {
    expect(normalizarUnidad('rollos')).toEqual(['rollo', 1]);
    expect(normalizarUnidad('gr')).toEqual(['kg', 0.001]);
    expect(normalizarUnidad('taco')).toEqual(['taco', 1]);
  });
});
