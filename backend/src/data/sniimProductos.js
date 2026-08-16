/**
 * CATÁLOGO SNIIM — productos y mercados
 *
 * SNIIM (Secretaría de Economía) publica precios de MAYOREO de 222 productos
 * en 49 centrales de abasto. Aquí vive un subconjunto curado a mano: los
 * productos de consumo alto en un hogar o una cocina mexicana.
 *
 * Por qué a mano y no los 222: cada consulta es una petición HTTP a un sitio
 * de gobierno. 26 productos son 26 peticiones diarias — un vecino educado.
 * 222 serían 222, y la mayoría (uva Calmeria, melón Cantaloupe #45) no le
 * importan a nadie que use CALC.
 *
 * OJO CON LOS NOMBRES: SNIIM le dice "Tomate Saladette" a lo que en México
 * todo el mundo llama jitomate. El campo `clave` es el nombre de la calle —
 * el que la usuaria escribe y con el que se guarda en CALC. El `sniim_id` es
 * el del gobierno. Traducir entre los dos es justo el trabajo de este archivo.
 *
 * El `articulo` (el/la) existe para que los avisos no salgan diciendo "papa
 * está más barato". CALC habla español mexicano de verdad; una concordancia
 * mal hecha lo delata como robot en la primera frase que lee la usuaria.
 */

// Central de Abasto de Iztapalapa: es la más grande de México y la que marca
// la referencia nacional. Es el default, pero se avisa que lo es y la usuaria
// puede escoger la suya — por eso `MERCADOS` está completo.
const MERCADO_DEFAULT = '100';

const PRODUCTOS = [
  { clave: 'jitomate', articulo: 'el', sniim_id: '839', sniim_nombre: 'Tomate Saladette' },
  { clave: 'tomate verde', articulo: 'el', sniim_id: '842', sniim_nombre: 'Tomate Verde' },
  { clave: 'cebolla', articulo: 'la', sniim_id: '183', sniim_nombre: 'Cebolla Bola' },
  { clave: 'papa', articulo: 'la', sniim_id: '740', sniim_nombre: 'Papa Alpha' },
  { clave: 'limón', articulo: 'el', sniim_id: '419', sniim_nombre: 'Limón c/semilla # 4' },
  { clave: 'aguacate', articulo: 'el', sniim_id: '133', sniim_nombre: 'Aguacate Hass' },
  { clave: 'chile serrano', articulo: 'el', sniim_id: '246', sniim_nombre: 'Chile Serrano' },
  { clave: 'chile jalapeño', articulo: 'el', sniim_id: '233', sniim_nombre: 'Chile Jalapeño' },
  { clave: 'chile poblano', articulo: 'el', sniim_id: '242', sniim_nombre: 'Chile Poblano' },
  { clave: 'plátano', articulo: 'el', sniim_id: '732', sniim_nombre: 'Plátano Tabasco' },
  { clave: 'manzana', articulo: 'la', sniim_id: '522', sniim_nombre: 'Manzana Red Delicious' },
  { clave: 'naranja', articulo: 'la', sniim_id: '551', sniim_nombre: 'Naranja Valencia mediana' },
  { clave: 'zanahoria', articulo: 'la', sniim_id: '880', sniim_nombre: 'Zanahoria mediana' },
  { clave: 'calabacita', articulo: 'la', sniim_id: '170', sniim_nombre: 'Calabacita Italiana' },
  { clave: 'pepino', articulo: 'el', sniim_id: '771', sniim_nombre: 'Pepino' },
  { clave: 'nopal', articulo: 'el', sniim_id: '560', sniim_nombre: 'Nopal' },
  { clave: 'elote', articulo: 'el', sniim_id: '307', sniim_nombre: 'Elote mediano' },
  { clave: 'chayote', articulo: 'el', sniim_id: '275', sniim_nombre: 'Chayote' },
  { clave: 'brócoli', articulo: 'el', sniim_id: '162', sniim_nombre: 'Brócoli' },
  { clave: 'ajo', articulo: 'el', sniim_id: '142', sniim_nombre: 'Ajo Blanco' },
  { clave: 'papaya', articulo: 'la', sniim_id: '609', sniim_nombre: 'Papaya Maradol' },
  { clave: 'piña', articulo: 'la', sniim_id: '651', sniim_nombre: 'Piña mediana' },
  { clave: 'melón', articulo: 'el', sniim_id: '516', sniim_nombre: 'Melón Cantaloupe' },
  { clave: 'sandía', articulo: 'la', sniim_id: '799', sniim_nombre: 'Sandía Rayada' },
  { clave: 'mango', articulo: 'el', sniim_id: '480', sniim_nombre: 'Mango Manila' },
  { clave: 'guayaba', articulo: 'la', sniim_id: '378', sniim_nombre: 'Guayaba' },
  { clave: 'fresa', articulo: 'la', sniim_id: '358', sniim_nombre: 'Fresa' },
  { clave: 'uva', articulo: 'la', sniim_id: '869', sniim_nombre: 'Uva sin semilla' }
];

/**
 * Las 49 centrales de abasto que publica SNIIM. La usuaria escoge la suya;
 * si no escoge, se usa Iztapalapa y CALC se lo dice.
 */
const MERCADOS = [
  { id: '10', nombre: 'Centro Comercial Agropecuario de Aguascalientes', estado: 'Aguascalientes' },
  { id: '33', nombre: 'Central de Abasto INDIA, Tijuana', estado: 'Baja California' },
  { id: '20', nombre: 'Unión de Comerciantes de La Paz', estado: 'Baja California Sur' },
  { id: '40', nombre: 'Mercado "Pedro Sáinz de Baranda"', estado: 'Campeche' },
  { id: '50', nombre: 'Central de Abasto de La Laguna, Torreón', estado: 'Coahuila' },
  { id: '80', nombre: 'Centros de distribución de Colima', estado: 'Colima' },
  { id: '70', nombre: 'Central de Abasto de Tuxtla Gutiérrez', estado: 'Chiapas' },
  { id: '71', nombre: 'Tapachula', estado: 'Chiapas' },
  { id: '61', nombre: 'Central de Abasto de Chihuahua', estado: 'Chihuahua' },
  { id: '63', nombre: 'Mercado de Abasto de Cd. Juárez', estado: 'Chihuahua' },
  { id: '100', nombre: 'Central de Abasto de Iztapalapa', estado: 'Ciudad de México' },
  { id: '102', nombre: 'Central de Abasto "Francisco Villa"', estado: 'Durango' },
  { id: '101', nombre: 'Centro de Distribución y Abasto de Gómez Palacio', estado: 'Durango' },
  { id: '110', nombre: 'Central de Abasto de León', estado: 'Guanajuato' },
  { id: '112', nombre: 'Mercado de Abasto de Celaya', estado: 'Guanajuato' },
  { id: '111', nombre: 'Módulo de Abasto Irapuato', estado: 'Guanajuato' },
  { id: '121', nombre: 'Central de Abastos de Acapulco', estado: 'Guerrero' },
  { id: '122', nombre: 'Chilpancingo de los Bravo', estado: 'Guerrero' },
  { id: '130', nombre: 'Central de Abasto de Pachuca', estado: 'Hidalgo' },
  { id: '140', nombre: 'Mercado de Abasto de Guadalajara', estado: 'Jalisco' },
  { id: '141', nombre: 'Mercado Felipe Ángeles de Guadalajara', estado: 'Jalisco' },
  { id: '151', nombre: 'Central de Abasto de Ecatepec', estado: 'Estado de México' },
  { id: '150', nombre: 'Central de Abasto de Toluca', estado: 'Estado de México' },
  { id: '160', nombre: 'Mercado de Abasto de Morelia', estado: 'Michoacán' },
  { id: '170', nombre: 'Central de Abasto de Cuautla', estado: 'Morelos' },
  { id: '172', nombre: 'Mercado "Adolfo López Mateos" de Cuernavaca', estado: 'Morelos' },
  { id: '180', nombre: 'Mercado de abasto "Adolfo López Mateos" de Tepic', estado: 'Nayarit' },
  { id: '181', nombre: 'Nayarabastos de Tepic', estado: 'Nayarit' },
  { id: '190', nombre: 'Mercado de Abasto "Estrella" de San Nicolás', estado: 'Nuevo León' },
  { id: '200', nombre: 'Módulo de Abasto de Oaxaca', estado: 'Oaxaca' },
  { id: '210', nombre: 'Central de Abasto de Puebla', estado: 'Puebla' },
  { id: '220', nombre: 'Mercado de Abasto de Querétaro', estado: 'Querétaro' },
  { id: '230', nombre: 'Mercado de Chetumal', estado: 'Quintana Roo' },
  { id: '231', nombre: 'Módulo de Abasto Cancún', estado: 'Quintana Roo' },
  { id: '240', nombre: 'Centro de Abasto de San Luis Potosí', estado: 'San Luis Potosí' },
  { id: '250', nombre: 'Central de Abasto de Culiacán', estado: 'Sinaloa' },
  { id: '252', nombre: 'Zona de Abasto de Mazatlán', estado: 'Sinaloa' },
  { id: '261', nombre: 'Central de Abasto de Cd. Obregón', estado: 'Sonora' },
  { id: '260', nombre: 'Mercado de Abasto "Francisco I. Madero" de Hermosillo', estado: 'Sonora' },
  { id: '270', nombre: 'Central de Abasto de Villahermosa', estado: 'Tabasco' },
  { id: '281', nombre: 'Módulo de Abasto de Reynosa', estado: 'Tamaulipas' },
  { id: '280', nombre: 'Módulo de Abasto de Tampico, Madero y Altamira', estado: 'Tamaulipas' },
  { id: '301', nombre: 'Central de Abasto de Jalapa', estado: 'Veracruz' },
  { id: '302', nombre: 'Central de Abasto de Minatitlán', estado: 'Veracruz' },
  { id: '306', nombre: 'Mercado Malibrán', estado: 'Veracruz' },
  { id: '310', nombre: 'Central de Abasto de Mérida', estado: 'Yucatán' },
  { id: '311', nombre: 'Centro Mayorista Oxkutzcab', estado: 'Yucatán' },
  { id: '312', nombre: 'Mercado "Casa del Pueblo"', estado: 'Yucatán' },
  { id: '320', nombre: 'Mercado de Abasto de Zacatecas', estado: 'Zacatecas' }
];

function mercadoPorId(id) {
  return MERCADOS.find((m) => m.id === String(id)) || null;
}

/** Nombre legible del mercado, para los avisos. */
function nombreMercado(id) {
  const m = mercadoPorId(id);
  return m ? m.nombre : `mercado ${id}`;
}

function productoPorClave(clave) {
  return PRODUCTOS.find((p) => p.clave === clave) || null;
}

module.exports = {
  PRODUCTOS,
  MERCADOS,
  MERCADO_DEFAULT,
  mercadoPorId,
  nombreMercado,
  productoPorClave
};
