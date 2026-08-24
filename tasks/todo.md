# Plan actual

> Este archivo tiene **el** plan en curso, no la lista de todo lo que existe.
> Al cerrar una iteración, su plan se archiva en `docs/planes/` y esto se vacía.
>
> Antes de tocar código: leer `AGENTS.md` (este Next.js y este Drizzle no son
> los del training data) y `tasks/lessons.md`.

## Identidad visual: meter el isologo real en la web

**Contexto**: `public/logos/` tiene el pack de marca, pero el sitio nunca lo usa.
La marca en pantalla es sólo el texto "GORROS WINE" en dorado, y `app/icon.svg`
es un gorro de cocinero **inventado** que no tiene nada que ver con la marca.

**Dirección elegida** (confirmada 2026-08-24): el rojo del isologo entra como
**segundo color de marca**. El dorado sigue siendo el acento tipográfico y de UI.
No se rediseña la paleta.

**Sin worktree, a propósito**: `scripts/worktree.ps1` basa todo worktree en
`origin/main`, y `origin/main` no tiene los archivos sin commitear del árbol
actual (route groups `(store)`/`(admin)`, `lib/db`, `lib/auth`). Un worktree
daría una base sin las pantallas que hay que tocar.

### Decisiones técnicas

- **El isologo se vectoriza**, no se usa el raster. El pack no trae SVG y su
  README desaconseja redibujarlo a mano — así que se **traza el canal alfa** de
  `isologo.png` (1254px, el original más limpio). No se reinterpreta nada.
  - Trazado por aristas de grieta + Douglas-Peucker, `epsilon = 1.5`.
  - Verificado: **16 contornos** (8 brazos × contorno + lazo), **2.31%** de
    píxeles distintos contra el raster ≈ 0.24 px de desvío de borde.
- **Dos pesos ópticos**. El trazo de la marca es el 1,93% de su ancho: por
  debajo de ~56px no llega a 1px y el símbolo se ve arácnido. Debajo de ese
  umbral se usa la misma geometría **dilatada 12px** en origen (trazo al 3,95%).
  12px es el máximo que conserva los 16 contornos: a 14 se cierran los lazos.
- **Rojo `#e00000`**, el de `isologo.png`. El pack de 512 usa `#c61312`, más
  apagado; se unifica en el del original grande.
  Da 3.88:1 sobre el fondo: **sirve para gráfico, no para texto**.

### Pasos

- [x] `scripts/_isotipo.mjs` — generador: traza, dilata, y escribe SVG + PNGs de
      iconos. Dry-run por defecto, escribe con `APPLY=1` (convención del repo).
- [x] `components/isotipo.tsx` — el símbolo como SVG inline con `currentColor`,
      que además elige el peso según el tamaño que le pidan.
- [x] `app/globals.css` — token `--red` bajo "marca", con la nota de contraste.
- [x] `app/icon.svg` — reemplazado el gorro inventado por la marca real.
- [x] `app/favicon.ico` + `app/apple-icon.png` — generados sobre `--night`.
- [x] `app/manifest.ts` + `public/icon-192.png` / `icon-512.png` — PWA.
- [x] `components/nav.tsx` + `.module.css` — lockup horizontal, isotipo 28px.
- [x] `components/footer.tsx` + `.module.css` — lockup vertical, isotipo 30px.
- [x] `components/age-gate.tsx` + `.module.css` — isotipo 72px, momento de marca.
- [x] `app/(admin)/admin/login/page.tsx` + `admin.module.css` — isotipo 40px.
- [x] Verificar: `npx tsc --noEmit`, `npm run build`, y las pantallas servidas.

## Review

**Qué se hizo.** El símbolo de la marca existe ahora como vector propio y aparece
en las cuatro pantallas donde se identifica el sitio, más los iconos de browser,
iOS y PWA. El dorado quedó intacto: el rojo entra sólo en el símbolo.

- `scripts/_isotipo.mjs` es la única fuente de los assets de marca. Traza
  `public/logos/isologo.png` y escribe seis archivos. Es idempotente, hace
  dry-run por defecto, y **aborta si el trazado no da 16 contornos** — si alguien
  cambia el original o sube la dilatación hasta tapar un lazo, falla en vez de
  emitir una marca deformada.
- `components/isotipo.tsx` decide el peso por tamaño (umbral 56px). Es un tamaño
  óptico, no dos logos: misma geometría, misma caja.
- Los pesos servidos quedaron verificados sobre el HTML del build:
  age gate 72px → fino (1.39px de trazo), nav 28px → icono (1.11px),
  footer 30px → icono (1.19px), login 40px → icono (1.58px). Todos sobre 1px.
- `--red` se declara también en `.themed` del panel, que redefine sus colores con
  `light-dark()`: es el único que no cambia por modo (5.04:1 en claro, 3.75:1 en
  oscuro), y se deja explícito para que se vea que fue mirado.

**Qué quedó afuera.**

- **Los favicons del pack no se usan.** `public/logos/favicon-*.png` y su
  `favicon.ico` son el símbolo fino reducido, y a 32px son una mancha rosa
  ilegible. Los reemplazan los generados. El pack queda como material de origen.
- **`#c61312` vs `#e00000`.** El pack de 512 y el logo completo traen el rojo más
  apagado; `isologo.png` trae el limpio. Se unificó en `#e00000` sin tocar los
  archivos del pack. Si la marca define oficialmente el otro, se cambia la
  constante del generador y se regenera.
- **No hay lockup con wordmark vectorial.** El wordmark sigue siendo texto
  (Fraunces), no el `gorros-wine-logo-transparent.png` del pack. Es mejor así
  —escala, se lee, es accesible— pero no es la tipografía original del logo.
- **Sin captura de pantalla del resultado final.** Se vieron el age gate y el nav
  en el navegador con `puppeteer-core`, que el trabajo de temas removió del
  proyecto a mitad de camino. El ajuste posterior de pesos se verificó sobre el
  HTML del build y rasterizando los dos pesos a 28px, no en pantalla.

**Qué habría que mirar después.**

- Si aparece el AI/EPS original de la marca, se tira `scripts/_isotipo.mjs` y se
  usa ese vector: el trazado es fiel al raster, pero un raster sigue siendo el
  techo.
- El símbolo da para más: separador de secciones, marca de agua en la ficha de
  producto, viñeta en las listas del club. No se hizo nada de eso para no
  saturar antes de ver cómo cae el rojo en el sitio real.
