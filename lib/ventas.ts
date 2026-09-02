import { notFound } from "next/navigation";

/**
 * Interruptor de la parte de ventas del sitio público.
 *
 * El catálogo que se ve hoy sale de los datos de muestra de `lib/data.ts`:
 * veintiséis vinos con precios inventados. El catálogo de verdad se está
 * modelando en la base (bodegas, productos, categorías, varietales,
 * cotización) y hasta que ese trabajo cierre la tienda no se muestra —
 * prometer envíos y precios que no existen es peor que no tener catálogo.
 *
 * Con esto en `false`: la home pierde las etiquetas destacadas y el "cómo
 * comprar", el nav pierde Catálogo, Buscar, Cuenta y Carrito, el footer pierde
 * Catálogo, y `/catalogo`, `/producto/:id`, `/carrito`, `/buscar` y `/cuenta`
 * responden 404 y salen del sitemap. No se borró nada: el diseño de la grilla,
 * la ficha, el carrito y la búsqueda esperan enteros del otro lado del flag.
 *
 * Para volver a prenderla:
 *
 * 1. `true` acá.
 * 2. Revisar desde el panel el texto de dos botones que mientras tanto apuntan
 *    al WhatsApp del local: `Home · Hero · texto del botón` y
 *    `Nosotros · Cierre · texto del botón`. Vuelven a llevar al catálogo, así
 *    que "Escribinos" deja de tener sentido ahí.
 */
export const VENTAS_ACTIVAS = false;

/**
 * Guarda de ruta, al estilo de `requireUser()` de `lib/auth`: va como primera
 * línea de las páginas que sólo existen con la tienda prendida.
 */
export function requireVentas() {
  if (!VENTAS_ACTIVAS) notFound();
}
