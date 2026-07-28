# Gorros Wine — Home

Home de la vinoteca Gorros Wine (Pilar, Buenos Aires), importada desde el
proyecto de Claude Design **Vinoteca de Pilar**
(`Gorros Wine - Home.dc.html`).

```bash
npm install
npm run dev      # http://localhost:3000
```

## Qué dirección se implementó

El archivo de diseño es un tablero de exploración con tres turnos y varias
opciones (1a/1b/1c → 2a → 3a/3b/3c), sin una elección marcada. Se implementó
la **opción 1b — "Noche premium": negro + dorado**, con Fraunces para títulos
y Jost para texto.

Tokens en [`app/globals.css`](app/globals.css):

| Token          | Valor     | Uso                          |
| -------------- | --------- | ---------------------------- |
| `--night`      | `#151110` | Fondo de la página           |
| `--night-deep` | `#0f0c0b` | Fondo fuera del contenedor   |
| `--gold`       | `#c9a24b` | Marca, acentos, botones      |
| `--heading`    | `#f3ecdd` | Titulares                    |
| `--text`       | `#ece3d2` | Texto general                |
| `--lede`       | `#b6ab97` | Bajadas                      |
| `--meta`       | `#9a907d` | Bodega, contadores           |

Tipografías vía `next/font/google` (Fraunces para títulos, Jost para texto):
se autoalojan en el build, sin pedidos a Google Fonts en runtime.

## Secciones

`app/page.tsx` compone, en orden: nav · hero centrado a sangre · franja de
categorías · etiquetas destacadas · Club Gorros · footer.

1b no tiene franja de confianza, ni sección de eventos, ni filtros por tipo
de vino: son de la rama bordó (1a/2a). Si hicieran falta, el diseño de esas
secciones está en `Gorros Wine - Sitio.dc.html`.

## Diferencias respecto del diseño

El diseño es un lienzo fijo de 1180 px con todo en `style=` inline. Al pasarlo
a código:

- **Responsive.** Se agregaron cortes en 1000 / 820 / 700 / 560 px: la grilla
  de vinos pasa de 4 → 2 → 1 columna, las categorías de 4 → 2, el titular del
  hero baja de 82 px a 38 px, y en móvil el nav deja sólo logo y carrito.
- **Semántica y accesibilidad.** Los `<span>` del diseño son ahora `<button>`,
  `<a>`, `<h1>`/`<h2>`/`<h3>` y listas, con `:focus-visible` visible y textos
  sólo para lectores de pantalla en el carrito y en "Agregar".
- **Nav sticky.** Tomado de `Gorros Wine - Sitio.dc.html`, que ya lo había
  adoptado; en 1b el nav no era fijo.

## Pendiente

- **Fotos.** Los bloques con trama diagonal y etiquetas `[ foto · … ]` marcan
  los huecos: fondo del hero (foto oscura de la cava) y las botellas.
  Reemplazar por `next/image`.
- **Carrito.** [`components/cart-context.tsx`](components/cart-context.tsx)
  sólo lleva la cuenta en memoria; falta persistencia y checkout.
- **Rutas.** `/catalogo`, `/club`, `/eventos`, `/nosotros`, `/producto/[id]`,
  `/carrito`, `/buscar`, `/cuenta` y `/reservar` están enlazadas pero no
  existen todavía — hoy dan 404. El diseño de casi todas ya está en
  `Gorros Wine - Sitio.dc.html`.
- **Datos.** [`lib/data.ts`](lib/data.ts) es estático, con los 4 vinos y las 4
  categorías del diseño. Los precios son strings ya formateados (`"$14.900"`);
  conviene pasarlos a número antes de conectar un carrito real.

## Nota sobre el cache de Next

No corras `npm run build` mientras `npm run dev` está activo: comparten el
directorio `.next` y el build de producción pisa los chunks que el dev server
tiene abiertos, con errores del tipo `Cannot find module './72.js'`. Si pasa,
frená el dev server, borrá `.next` y volvé a arrancar.
