# Gorros Wine

Sitio de la vinoteca Gorros Wine (Pilar, Buenos Aires), importado desde el
proyecto de Claude Design **Vinoteca de Pilar**.

```bash
npm install
npm run dev      # http://localhost:3000
```

## Qué diseño se implementó

`Gorros Wine - Sitio v2.dc.html` — la versión negra y dorada del sitio
completo, con Fraunces para títulos y Jost para texto. El rasgo tipográfico
de v2 es la micro-tipografía en mayúsculas con mucho tracking (antetítulos,
botones, etiquetas).

Antes de v2 se había implementado la opción **1b** del tablero de exploración
(`Gorros Wine - Home.dc.html`); v2 confirmó esa dirección pero afinó la paleta
y reestructuró la home.

Tokens en [`app/globals.css`](app/globals.css):

| Token         | Valor     | Uso                          |
| ------------- | --------- | ---------------------------- |
| `--night`     | `#0d0c0b` | Fondo                        |
| `--gold`      | `#c8a253` | Marca, acentos, botones      |
| `--heading`   | `#f5efe4` | Titulares                    |
| `--text`      | `#efe9df` | Texto general                |
| `--muted`     | `#8d867a` | Bajadas, texto secundario    |
| `--dim`       | `#6b6459` | Texto terciario, legales     |
| `--chip`      | `#b3aa9b` | Filtros y maridajes          |

Tipografías vía `next/font/google`: se autoalojan en el build, sin pedidos a
Google Fonts en runtime.

## Rutas

| Ruta              | Render  | Qué es                                      |
| ----------------- | ------- | ------------------------------------------- |
| `/`               | estático | Home v2 completa                           |
| `/catalogo`       | dinámico | Grilla con filtros; lee `?tipo=`           |
| `/producto/[id]`  | SSG (9)  | Ficha; 404 en un id inexistente            |
| `/nosotros`       | estático | Historia, valores y cierre                 |
| `/eventos`        | estático | Agenda, Caminos del Vino, cata privada     |

La home compone: hero (foto) · beneficios · etiquetas destacadas · Club ·
eventos · acerca de nosotros · reseñas · cómo comprar.

**"Club" no es una página**: el nav apunta a `/#club`, un ancla a la banda del
club en la home, como en v2.

## Age gate

Requisito legal para venta de alcohol. El overlay se renderiza siempre en el
servidor; un script inline al principio del `<body>`
([`components/age-gate.tsx`](components/age-gate.tsx)) lee `localStorage` y
marca `<html data-age-ok="1">` **antes de pintar**, y el CSS lo oculta desde
ahí.

Se hace así, y no con estado de React, por dos razones: quien ya confirmó no
ve ningún parpadeo, y el HTML del servidor es siempre el mismo, así que no hay
desajuste de hidratación.

Para volver a verlo: `localStorage.removeItem("gw-age-ok")` y recargar.

## Diferencias respecto del diseño

El diseño es un lienzo fijo de 1180 px con todo en `style=` inline. Al pasarlo
a código:

- **Responsive.** Cortes en 1000 / 900 / 820 / 700 / 560 px: las grillas pasan
  de 4 → 2 → 1 columna, los bloques partidos se apilan, y el nav reordena los
  enlaces debajo del logo.
- **Semántica y accesibilidad.** Los `<span>` del diseño son ahora `<button>`,
  `<a>`, headings y listas, con `:focus-visible` y textos sólo para lectores de
  pantalla en el carrito, "Agregar" y "Reservar".
- **Filtros funcionales.** En el diseño las píldoras del catálogo son
  decorativas; acá filtran de verdad y son acumulables.
- **Bodegas derivadas de los datos.** El diseño lista 3 fijas; acá salen de
  `wines`, así que aparecen solas al agregar una.
- **Botón "Agregar" en las tarjetas.** v2 no lo tiene (la tarjeta sólo lleva a
  la ficha). Se mantuvo porque ya estaba y es útil en una tienda —
  si molesta, se saca de [`components/wine-card.tsx`](components/wine-card.tsx).
- **Nav sticky**, tomado de la versión Sitio.

## Pendiente

- **Fotos.** Sólo `hero-home` está cargada en el proyecto de design y ya se usa
  ([`public/hero-home.webp`](public/hero-home.webp)). Los demás huecos se
  renderizan con [`components/photo-slot.tsx`](components/photo-slot.tsx):
  `evento-1`, `evento-2` (home), `evento-3`, `evento-4` (eventos),
  `nosotros-home` y `nosotros-hero`. Cuando se carguen, se extraen igual que el
  hero y se pasan a `next/image`.
- **Carrito.** [`components/cart-context.tsx`](components/cart-context.tsx)
  sólo lleva la cuenta en memoria: se pierde al recargar y no sabe qué se
  agregó. Falta items, cantidades, persistencia y checkout.
- **Rutas sin construir.** `/club`, `/carrito`, `/buscar`, `/cuenta`,
  `/terminos`, `/privacidad` y `/reservar` están enlazadas pero dan 404.
- **Newsletter.** El formulario del footer postea a `/api/newsletter`, que no
  existe.
- **Copy de producto.** Todas las fichas comparten `placeholderDescription`,
  tal como el diseño. Faltan las notas de cata reales.

## Nota sobre el cache de Next

No corras `npm run build` mientras `npm run dev` está activo: comparten el
directorio `.next` y el build de producción pisa los chunks que el dev server
tiene abiertos, con errores del tipo `Cannot find module './72.js'`. Si pasa,
frená el dev server, borrá `.next` y volvé a arrancar.
