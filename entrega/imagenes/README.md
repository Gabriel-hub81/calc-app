# Imágenes para Devpost

Los tres archivos son PNG y ninguno pasa de 420 KB — muy por debajo del
límite de 5 MB.

| Archivo | Tamaño | Para qué |
|---|---|---|
| `calc-portada-1200.png` | 1200×1200 · 419 KB | **Imagen principal del proyecto** (la que se ve en la tarjeta de la galería) |
| `calc-logo-1200.png` | 1200×1200 · 84 KB | **Logo** — la libreta con palomitas y el wordmark, sobre fondo claro |
| `calc-icono-1024.png` | 1024×1024 · 26 KB | **Ícono** — el «=» sobre azul noche, el mismo de la app instalada |

## Por qué cada uno se ve así

**El ícono** es el «=» de la app: dos barras verdes sobre azul noche. Es el
favicon, el ícono de instalación de la PWA y lo que aparece en la pantalla
del celular. Sale tal cual de `frontend/public/icon.svg`, sin retocar.

**El logo** es la libreta con las palomitas: los pendientes ya resueltos, y
en el último renglón el mismo «=» del ícono — la cuenta hecha. Los dos son la
misma familia. Va sobre fondo claro (`#f8fafc`) porque la interfaz de Devpost
es clara y un logo con fondo oscuro se recorta feo en sus tarjetas.

**La portada** usa el mismo lenguaje visual de las tarjetas del video: fondo
casi negro con sesgo verde, el nombre grande, y la raya del ticket —esa que
va arriba del total y significa "todo lo de arriba suma esto"— separando el
nombre de lo que el proyecto es. Cierra con la línea que resume el criterio
que califica el concurso: *five agents · running daily · nobody at a keyboard*.

## Si Devpost pide otra proporción

La portada es cuadrada a propósito: Devpost recorta al centro para sus
tarjetas, y todo el contenido está en la mitad izquierda-centro, así que
sobrevive cualquier recorte razonable. Si el formulario exige 16:9 o 3:2 y
no acepta el cuadrado, avísame y la vuelvo a generar con esa proporción.
