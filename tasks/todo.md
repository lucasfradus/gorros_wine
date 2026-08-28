# Plan actual

> Este archivo tiene **el** plan en curso, no la lista de todo lo que existe.
> Al cerrar una iteración, su plan se archiva en `docs/planes/` y esto se vacía.
>
> Antes de tocar código: leer `AGENTS.md` (este Next.js y este Drizzle no son
> los del training data) y `tasks/lessons.md`.

**Franja de bodegas en la home.**
Iteración chica: la pantalla que consume el flag que ya existe. Sin plan en
`docs/planes/`.

Worktree `../Gorros-carrusel-bodegas` · rama `feat/carrusel-bodegas` · puerto
`:3006`

La iteración anterior modeló `bodegas.logo` y `bodegas.mostrar_en_home` y dejó
esto escrito en el schema: *"Todavía no lo lee nadie… se modela ahora para que
el día que la franja exista no arranque vacía."* Esta iteración es ese día.

- [x] **Datos** — `lib/bodegas.ts`: las que van en la home, cacheadas por tag.
- [x] **Franja** — `components/home-bodegas.tsx` + su módulo CSS: marquee en CSS
      puro, sin JavaScript.
- [x] **Copy** — tres campos en el grupo `home` del registro del CMS.
- [x] **Montaje** — la sección en `app/(store)/page.tsx`.
- [x] **Invalidación** — el tag y `/` en las actions de bodegas.
- [x] **Logos de tinta blanca** — `scripts/_logos-tinta-clara.mjs` invirtió 14
      de los 15. El quince (Ernesto Catena) es dorado y no blanco: darlo vuelta
      le cambiaba el color de marca, así que el script lo saltea solo.
- [x] **Textos que habían quedado viejos** — el schema y el formulario decían
      que la franja no existía.
- [x] **Verificación** — `tsc`, `build` y la home servida en `:3006`. Detalle
      abajo.
- [ ] **Cierre** — PR a `main` y `./scripts/worktree.ps1 borrar carrusel-bodegas
      -borrarRama`.

## Decisiones

- **Quién entra**: `mostrar_en_home` **y** logo cargado **y** `is_active`. Lo
  tercero no lo pidió nadie pero se agrega: una bodega archivada es un proveedor
  al que se dejó de comprarle, y no corresponde publicitarlo en la portada.
- **Chip claro, y no los logos sueltos sobre el negro.** Los 62 logos cargados
  se midieron uno por uno contra el bucket (alpha, cobertura, luma medio de los
  píxeles opacos): 32 son opacos con fondo blanco, 10 están calados con tinta
  oscura, 5 son de tono medio y **15 están calados con tinta blanca**. No existe
  un fondo que los muestre a los 62. Sobre un chip claro se ven 47 tal cual, y
  los 15 restantes se arreglan **en el dato**, invirtiéndoles la tinta una sola
  vez, en vez de pelearlo con CSS.
- **Marquee en CSS puro y no un carrusel con estado.** No hay nada que un
  client component agregue acá: son logos que se desplazan. Se frena al pasar el
  mouse y al tabular, y con `prefers-reduced-motion` no se mueve nunca.
- **Una bodega sin sitio web se muestra igual**, con el logo sin enlace. Son 7
  de las 62; esconderlas sería castigar a la bodega por un campo vacío del
  panel.
- **Qué bodegas van en la home lo decide el panel**, no este código. Hoy no hay
  ninguna tildada: la sección no se dibuja hasta que alguien elija.

## Viene de la iteración anterior (sigue pendiente)

- **Diecinueve bodegas sin logo**: Antucura, De Angeles, Rimapere, Costa &
  Pampa, Altocedro, Abras, Teho, TintoNegro, Matías Riccitelli, Bressia, Manos
  Negras, Codorníu, Tapiz, LTU, Achaval Ferrer, Mil Demonios, Alandes, Fernando
  Dupont y Piatelli. Se agregan desde el panel.
- **Doce carpetas del Drive son portfolios** con varias marcas adentro. Hay que
  decidir qué es bodega y qué es marca antes de cargarlas.
- **`productos.imagen_key` sigue con la forma vieja** (texto con la key, sin
  usar). Cuando el catálogo sume su foto, conviene pasarlo a `jsonb`.

## Cómo se verificó

- `npx tsc --noEmit` y `npm run build` en verde, con el dev bajado. La home
  **sigue prerenderizada** (`○` en la salida del build): leer las bodegas no la
  volvió dinámica, que era el riesgo de sumarle una consulta.
- El HTML que salió del build, con 18 bodegas tildadas: 17 chips con `<a
  target="_blank" rel="noopener noreferrer">`, 1 sin enlace (Bodega Rolland, la
  única sin sitio cargado), 18 clones en una lista `aria-hidden` y sin enlaces,
  `--dur:72s`. Un solo `alt` con texto —el del chip sin enlace—: en los
  enlazados el nombre accesible lo pone el texto oculto, y en los clones no
  hay ninguno, que es lo correcto.
- El gateway sirve los logos invertidos (`/media/img/7a2268e490fccaf3.webp` →
  200, `image/webp`, 10 KB).
- **`next/image` conserva la transparencia**: pedida como la pide un navegador,
  la versión optimizada vuelve `webp 256×108` con canal alfa. Era el riesgo de
  la tinta invertida — si el optimizador la aplastara, cada logo calado saldría
  con un recuadro negro sobre el chip blanco.
- Los 14 logos invertidos se miraron **uno por uno** en la lámina que arma el
  propio script en dry-run, antes de escribir nada.
- Con la geometría exacta del chip (168×96, padding 16/20, `contain`) se armó
  una lámina de la franja para revisar el diseño con los 18 logos reales.

**Lo que no se pudo verificar sin navegador**: que el marquee se frene al pasar
el mouse y al tabular, y el comportamiento con «reducir movimiento». Es CSS sin
lógica, pero se mira al abrir `:3006`. Tampoco se probó la franja vacía: es un
`return null` de una línea, y para verlo habría que destildar las 18 bodegas de
la base compartida.

## Review

**Qué se hizo.** La portada muestra la franja de bodegas: los logos en una
tarjeta clara, desplazándose en loop, y cada uno lleva al sitio de su bodega.
Entra la que tenga tildado «mostrar en el home», logo cargado y no esté
archivada. El encabezado se edita desde el CMS.

**La decisión que costó.** El chip claro no es un gusto estético: es lo que
imponen los logos que ya están cargados. Medidos uno por uno, 47 de 62 piden
fondo claro y 15 piden fondo oscuro, así que no había un fondo que los mostrara
a todos. Se eligió el que sirve para la mayoría y se arreglaron los 15 en el
dato. El chip además es **blanco puro** y no un crema de la paleta, porque 33
de los logos traen su propio fondo blanco opaco: con cualquier otro tono se les
vería el recuadro recortado adentro del chip. Por lo mismo el hover mueve el
borde y nunca el fondo.

**Lo que la franja dejó a la vista.** Poner los logos juntos y al mismo tamaño
mostró tres archivos que están mal de origen, y que el script ahora nombra en
vez de dejar pasar:

- **Huentala Wines** y **Terrazas de los Andes**: el archivo trae dos o tres
  versiones del logo apiladas, así que en el chip entran todas, diminutas.
- **Insurrecto Wines**: viene con fondo negro propio.
- **Ernesto Catena Vineyards**: calado pero dorado. Se ve, aunque desvaído
  sobre blanco.

Los cuatro se arreglan subiendo otro archivo desde el panel. Ninguno rompe
nada: son cuatro de las 62 con logo.

**Deuda que deja.**

- Los logos originales de los 14 invertidos siguen en el bucket. Es a propósito
  —son el camino de vuelta— pero nadie los va a limpiar nunca: no hay recolector
  de imágenes huérfanas, y el día que haya, tiene que saber de esto.
- **Cargar los logos invertidos en producción**: el mismo script apuntando a
  Railway. Los bytes nuevos hay que subirlos, que es lo que el script hace.
