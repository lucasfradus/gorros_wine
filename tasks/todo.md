# Plan actual

> Este archivo tiene **el** plan en curso, no la lista de todo lo que existe.
> Al cerrar una iteración, su plan se archiva en `docs/planes/` y esto se vacía.
>
> Antes de tocar código: leer `AGENTS.md` (este Next.js y este Drizzle no son
> los del training data) y `tasks/lessons.md`.

**Apagar la parte de ventas del sitio público.**
Iteración chica: un interruptor y los lugares que cuelgan de él. Sin plan en
`docs/planes/`.

Worktree `../Gorros-sin-ventas` · rama `feat/sin-ventas` · puerto `:3008`

El catálogo que ve un visitante hoy es el de muestra de `lib/data.ts`:
veintiséis vinos con precios inventados. El de verdad se está modelando en la
base y todavía no está para mostrarse. Hasta entonces, la mitad de venta del
sitio público se apaga entera — sin borrar nada, para volver a prenderla con una
línea.

- [x] **El interruptor** — `lib/ventas.ts`: `VENTAS_ACTIVAS` y `requireVentas()`,
      con el porqué y la checklist para prenderlo de nuevo.
- [x] **La home** — `app/(store)/page.tsx` sin etiquetas destacadas ni "cómo
      comprar". Beneficios queda, como se pidió.
- [x] **Los dos botones que iban al catálogo** — hero y cierre de Nosotros
      abren el WhatsApp del local; los textos por defecto del CMS pasan a
      "Escribinos".
- [x] **Nav y footer** — se van Catálogo, Buscar, Cuenta y Carrito. El contador
      sale a un `CartLink` propio para no llamar `useCart()` cuando no se pinta.
- [x] **Las rutas** — `/catalogo`, `/producto/:id`, `/carrito`, `/buscar` y
      `/cuenta` responden 404, y la ficha no prerenderiza nada.
- [x] **El carrito no se monta** — el layout de `(store)` saltea el
      `CartProvider` cuando no hay ventas.
- [x] **Sitemap** — sin `/catalogo` ni las fichas. `robots.txt` no se toca.
- [x] **Documentación** — `docs/ARQUITECTURA.md` con la sección del flag.
- [x] **Verificación** — `tsc`, `build` y las nueve rutas servidas en `:3008`,
      con la prueba de ida y vuelta del flag. Detalle abajo.
- [ ] **Cierre** — PR a `main` y `./scripts/worktree.ps1 borrar sin-ventas
      -borrarRama`.

## Decisiones

- **Un interruptor y no un borrado.** El diseño de la grilla, la ficha, el
  carrito y la búsqueda son trabajo hecho que la versión con datos reales va a
  reusar. Borrarlo obligaría a ir a buscarlo a un `git revert`.

- **404 y no `Disallow`.** Las rutas de venta responden 404 en vez de anunciarse
  como prohibidas en `robots.txt`. Un `Disallow` le impide a Google entrar, y
  sin entrar nunca ve el 404 ni saca la URL del índice.

- **Los botones al WhatsApp y no escondidos.** El hero sin botón queda flojo, y
  el WhatsApp del local es la única forma real de comprar hoy. Es lo que ya
  hacen el Club y la ficha de contacto.

- **El texto de esos botones sigue saliendo del CMS.** Cambian los `original`
  del registro ("Ver catálogo" → "Escribinos"), no el componente. El costo es
  que al volver a prender las ventas hay que revisar esos dos textos: queda
  anotado en el comentario de `lib/ventas.ts`, que es lo primero que se lee al
  darlo vuelta.

## Review

**Qué se tocó.** Trece archivos: uno nuevo (`lib/ventas.ts`) y doce que ahora
cuelgan de él — la home, el layout de `(store)`, el hero, el footer, el nav,
`lib/data.ts` (navLinks), las cinco rutas de venta, el sitemap, el registro del
CMS y `docs/ARQUITECTURA.md`.

**Verificado.**

- `npx tsc --noEmit` limpio.
- `npm run build` completo. `/producto/[id]` sigue siendo SSG pero ya no
  prerenderiza fichas: `generateStaticParams()` devuelve `[]`.
- Servido en `:3008`: `/` 200 sin etiquetas destacadas ni "cómo comprar", nav
  con Eventos/Club/Nosotros y nada más, footer sin Catálogo, botón del hero a
  `wa.me`; `/catalogo`, `/carrito`, `/buscar`, `/cuenta` y `/producto/1` en 404;
  `/eventos`, `/club` y `/nosotros` en 200; `/sitemap.xml` sin catálogo ni
  fichas; el cierre de Nosotros a `wa.me`.
- **Ida y vuelta**: con `VENTAS_ACTIVAS = true` las cinco rutas vuelven a 200 y
  la home recupera las dos secciones. Se dejó en `false`.

**Lo que el flag no hace.** No achica el bundle: webpack no propaga una
constante entre módulos, así que `cart-context` y los vinos de muestra de
`lib/data` siguen viajando al browser aunque no se rendericen. Es código muerto,
no una fuga: nada de eso se pinta ni se ejecuta. Si algún día molesta, la salida
es un `NEXT_PUBLIC_*`, que Next sí inlinea en build.

**Deuda que deja.**

- La columna del footer se sigue llamando **"Tienda"** y ahora lista sólo Club y
  Eventos. Es un campo del CMS (`footer.tiendaTitulo`): se cambia desde el panel
  cuando se decida cómo llamarla.
- El inicio del panel sigue contando los vinos de muestra de `lib/data.ts`. Es
  la mitad privada y `feat/admin-catalogo` ya está reemplazando ese conteo por
  el real, así que no se tocó.
- En producción, el texto de los dos botones puede estar editado desde el panel:
  el `original` nuevo no pisa lo guardado. Hay que mirarlo después del deploy.
