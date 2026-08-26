# Gateway de imágenes — Plan

> **Para quien lo ejecute**: este plan es autocontenido. Todo el contexto
> necesario está acá; no hace falta releer la conversación donde se decidió.
> Antes de tocar código, leer `AGENTS.md` y `tasks/lessons.md`.
> Los pasos van con checkbox (`- [ ]`) y se marcan a medida que avanzan.

**Objetivo:** que toda imagen que entra al sitio pase por una sola función que
la endereza, le saca los metadatos, la achica y la comprime a WebP antes de
tocar el bucket. Al terminar, alguien sube una foto de celular de 4 MB desde
cualquier sección del panel y en el bucket queda un WebP de ~130 KB, derecho y
sin coordenadas GPS adentro.

**Enfoque:** el gateway **ya existe** —`uploadMediaAction` es la única puerta y
la usan el CMS, la agenda de eventos y en breve el catálogo—; lo que falta es
el paso del medio. Se agrega una función pura `prepararImagen()` en
`lib/content/imagen.ts` y la action queda como cáscara de permisos y base. La
compresión por breakpoint no se toca: eso ya lo hace `next/image` al servir.

**Worktree:** `../Gorros-media-gateway` · rama `feat/media-gateway` · puerto `:3005`

---

## Contexto

Hoy [media-actions.ts](../../app/(admin)/admin/(panel)/media-actions.ts) sube al
bucket **los bytes tal como llegaron**. Eso deja cuatro problemas, y el primero
es un bug que ya está en producción:

1. **Las fotos verticales de celular se guardan acotadas al revés.**
   `medirImagen` lee el ancho y el alto de la cabecera del archivo e **ignora
   el tag EXIF Orientation**. Un iPhone graba el sensor apaisado (4032×3024) y
   marca "rotar 90°". Guardamos `width: 4032, height: 3024`, el navegador la
   pinta vertical, y `next/image` reserva una caja apaisada: la maqueta salta
   cuando carga. Reproducible subiendo cualquier foto vertical de celular.
2. **Se publican los metadatos.** Las fotos de celular traen EXIF con
   coordenadas GPS, modelo y fecha. Hoy salen enteras por `/media/...`.
3. **El tope de 4 MB rechaza fotos de celular.** Quien carga contenido recibe
   *"La imagen pesa 5.8 MB y el máximo son 4 MB. Achicala e intentá de nuevo"*
   — le pedimos al usuario que haga a mano lo que la app tiene que hacer sola.
4. **Bucket y ancho de banda.** Un JPEG de 4 MB queda 4 MB para siempre, y cada
   miss de caché del optimizador lo vuelve a bajar entero por nuestro proxy.

Medido en este worktree con `sharp` sobre una foto de 12 MP rotada por EXIF:
**1.17 MB → 105 KB (91% menos) en 375 ms**, derecha y sin EXIF.

## Mapa del código actual

| Qué | Dónde |
| --- | --- |
| La action que sube (el gateway) | [media-actions.ts](../../app/(admin)/admin/(panel)/media-actions.ts) |
| Cliente S3 del bucket privado de Railway | [lib/content/bucket.ts](../../lib/content/bucket.ts) |
| Parser de medidas a mano + `detectarFormato` | [lib/content/image-size.ts](../../lib/content/image-size.ts) |
| Ruta que sirve las imágenes (caché inmutable 1 año) | [route.ts](../../app/media/[...key]/route.ts) |
| Campo de imagen del panel (lo usan las 3 secciones) | [image-field.tsx](../../app/(admin)/admin/(panel)/image-field.tsx) |
| Tipo `ImagenValor` (`src`/`alt`/`width`/`height`) | [lib/content/types.ts](../../lib/content/types.ts) |
| Tabla `media` (`key`, `mime`, `bytes`, `width`, `height`) | [lib/db/schema.ts](../../lib/db/schema.ts) (línea 139) |
| Límite del cuerpo de las Server Actions | [next.config.mjs](../../next.config.mjs) |
| Cómo se pinta en la tienda (optimizado por `next/image`) | [content-image.tsx](../../components/content-image.tsx) |

## Decisiones ya tomadas (NO volver a preguntar)

1. **Un solo WebP canónico por imagen. Sin derivados en el bucket.**
   `next/image` ya genera las variantes por breakpoint y sirve AVIF/WebP al
   vuelo, y la tienda ya lo usa así (`ContentImage` no pasa `unoptimized`).
   Un sistema de derivados propio es reimplementar eso y cuesta meses.
2. **`sharp` como motor.** Ya está instalado —0.34.5, dependencia opcional de
   Next— y **ya figura en la lista de `serverExternalPackages` que Next trae
   por defecto**, así que `next.config.mjs` no necesita tocarse por esto. Sí se
   promueve a dependencia explícita en `package.json`: hoy estamos colgados de
   que Next lo siga trayendo.
3. **La key hashea la _salida_, no la entrada.** La ruta sirve
   `immutable, max-age=31536000` apoyada en que la key *es* el contenido. Si
   hasheáramos el original, el día que cambiemos la calidad la misma URL
   devolvería bytes distintos y envenenaríamos cachés que no podemos purgar.
   Efecto buscado: cambiar el pipeline genera keys nuevas, y las viejas siguen
   siendo válidas mientras alguien las referencie.
4. **EXIF afuera, ICC adentro.** Se stripean EXIF/XMP/IPTC (privacidad y peso)
   pero se conserva el perfil de color con `keepIccProfile()`: medido, cuesta
   menos de 1 KB, y sin él una foto en Display P3 se ve con los colores
   corridos. Es una tienda de vinos: el color de la etiqueta importa.
5. **Tope de 2400 px de lado mayor.** El slot más ancho del sitio es 1180 px
   (`sizes` de `ContentImage`), y 2400 lo cubre a 2× en pantalla retina.
   Medido sobre una foto de 12 MP: 2000 px → 105 KB, 2400 px → 128 KB. Los
   23 KB de diferencia valen la nitidez. Nunca se agranda (`withoutEnlargement`).
6. **Con alfa y chica → WebP sin pérdida; el resto → q82.** El canal alfa en
   este proyecto significa logo, no foto, y q82 le come los bordes duros. La
   condición lleva un techo de 1 MP para que un PNG que en realidad es una foto
   con transparencia no salga enorme. Medido en el logo de 512×512: 34 KB con
   pérdida contra 42 KB sin pérdida. Es la **única** heurística del pipeline:
   si molesta, se borra sin tocar nada más.
7. **`detectarFormato` se queda como allowlist previa.** Antes de darle bytes
   crudos a libvips se confirma por firma que es JPG, PNG o WebP, y se le pone
   `limitInputPixels: 60e6`. Un PNG de 2 MB puede descomprimir a 50000×50000, y
   libvips tiene historial de CVEs. Defensa en profundidad, no redundancia.
8. **`medirImagen` se borra.** Sus ~150 líneas de parser de cabeceras a mano
   existían para sacar el ancho y el alto; ahora sharp los devuelve del
   resultado, que además es el que hay que medir. `image-size.ts` desaparece y
   lo que sobrevive (`detectarFormato`, `FORMATOS`) se muda a `imagen.ts`.
9. **Sin backfill.** `media` tiene **0 filas** en la base compartida. Si
   producción también está vacía —hay que confirmarlo—, no hay nada que migrar.
   Y aunque hubiera: las imágenes viejas siguen sirviéndose bien, porque la
   ruta lee el `mime` de la fila. El backfill sería opcional y cambiaría las
   keys, lo que obliga a reescribir las referencias en `content` y `eventos`.
10. **Se normaliza siempre, aunque sea la misma foto repetida.** La
    deduplicación ahora ocurre después de normalizar (hay que tener la salida
    para hashearla), así que resubir la misma imagen cuesta ~400 ms de CPU. Es
    una acción de panel, con sesión y permiso: no hace falta una caché por hash
    del original.

## Fuera de alcance

- **HEIC.** Los binarios precompilados de sharp traen libheif **sólo con AV1**
  (`sharp.format.heif.input.fileSuffix` es `[".avif"]`), sin HEVC por licencia:
  un `.heic` de iPhone **no se puede decodificar** acá. En la práctica el
  selector de archivos de iOS sube JPEG a un formulario web. Si algún día
  aparece el caso, el mensaje de error ya lo cubre.
- **Aceptar AVIF de entrada.** sharp lo lee, pero suma una rama en la allowlist
  y hoy nadie sube AVIF. Queda anotado como posible seguimiento.
- **Pre-encoger en el navegador** antes de subir. Resolvería el límite del
  cuerpo de la Server Action sin gastar CPU del servidor, pero la normalización
  tiene que estar **garantizada** en el servidor igual, porque ahí está el
  límite de confianza. Se evalúa después, y sólo si subir desde el celular se
  siente lento.
- **Guardar el peso original en `media`** para mostrar "4 MB → 128 KB" en el
  panel. Es lindo y es una migración; no ahora.
- **Recortes y arte de tapa.** Encuadrar una foto es otra iteración.

---

## Archivos

- **Crear** `lib/content/imagen.ts` — el gateway de verdad: `detectarFormato()`
  (allowlist por firma, se muda tal cual) y `normalizarImagen()`, que es toda
  la lógica nueva. Función pura: entra un `Uint8Array`, sale
  `{ bytes, mime, width, height }`. Sin `"use server"`, sin auth y sin base,
  para que la pueda llamar también un script.
- **Borrar** `lib/content/image-size.ts` — `medirImagen` ya no hace falta;
  `detectarFormato` y `FORMATOS` se mudan a `imagen.ts`.
- **Modificar** `app/(admin)/admin/(panel)/media-actions.ts` — llama a
  `normalizarImagen()`, hashea la salida, sube y registra el resultado.
- **Modificar** `next.config.mjs` — subir `bodySizeLimit` a `12mb`.
- **Modificar** `package.json` — `sharp` como dependencia explícita.
- **Modificar** `app/(admin)/admin/(panel)/image-field.tsx` — el texto de
  "Subiendo…", que ahora incluye un segundo de compresión.

---

## Tarea 1: la función que normaliza

**Archivos:** crear `lib/content/imagen.ts`, borrar `lib/content/image-size.ts`

- [x] **Paso 1**: mudar `detectarFormato`, `FORMATOS` y el tipo `Formato` desde
      `image-size.ts`, sin cambios. Borrar `medirImagen` y sus tres parsers.
- [x] **Paso 2**: escribir `prepararImagen(bytes)` con este pipeline:
      `sharp(bytes, { limitInputPixels: 60e6 })` → `.rotate()` (aplica EXIF
      Orientation) → `.resize({ width: 2400, height: 2400, fit: "inside",
      withoutEnlargement: true })` → `.webp(...)` → `.keepIccProfile()` →
      `.toBuffer({ resolveWithObject: true })`. Las medidas salen del `info`
      que devuelve, que ya es el de la salida.
- [x] **Paso 3**: la regla de la calidad — con alfa y ≤ 1 MP, `{ lossless: true }`;
      si no, `{ quality: 82 }`. El alfa y las medidas de entrada salen de
      `sharp(bytes).metadata()` antes del pipeline.
- [x] **Paso 4**: envolver los errores de sharp. Un archivo corrupto tiene que
      volver como un mensaje que se pueda leer, no como una excepción cruda
      —la action la mostraría como "no se pudo guardar", que miente sobre la
      causa—. Comentar **por qué** en castellano, como pide `CLAUDE.md`.
- [x] **Verificar**: `npx tsc --noEmit` en verde.

## Tarea 2: cablear la action

**Archivos:** modificar `media-actions.ts`

- [x] **Paso 1**: después de `detectarFormato`, llamar a `prepararImagen()`.
- [x] **Paso 2**: hashear **la salida** y armar la key `img/<hash>.webp`.
      El `mime` que se guarda es el de la salida (`image/webp`), no el de la
      entrada.
- [x] **Paso 3**: `bytes`, `width` y `height` de la fila de `media` pasan a ser
      los del archivo normalizado. `originalName` se sigue guardando como llegó.
- [x] **Paso 4**: subir el tope a 10 MB y reescribir el mensaje del tope:
      ya no dice "achicala", porque ahora achicamos nosotros.
- [x] **Verificar**: `npx tsc --noEmit`, y que no quede ningún import de
      `image-size` (`grep -rn "image-size" app lib`).

## Tarea 3: los límites de alrededor

**Archivos:** modificar `next.config.mjs`, `package.json`, `image-field.tsx`

- [x] **Paso 1**: `serverActions.bodySizeLimit` de `6mb` a `12mb`, con el
      comentario al día (el de hoy explica el 6 hablando del tope de 4 MB).
- [x] **Paso 2**: `sharp` a `dependencies` con la versión que ya está instalada
      (`^0.34.5`). Confirmar que `npm install` no rompe el lockfile.
- [ ] **Paso 3**: ~~el botón dice "Subiendo…" y ahora también comprime~~ —
      **no se hizo, a propósito**: "Subiendo" no miente, preparar la imagen es
      parte de subirla, y "Procesando…" es más vago. En su lugar el campo ganó
      dos cosas que sí faltaban (ver Review).
- [x] **Verificar**: `npm run build` en verde. **Bajar el `dev` antes** — está
      en `tasks/lessons.md` y ya rompió una sesión.

## Tarea 4: probarlo con fotos de verdad

- [ ] **Paso 1**: `npm run dev -- -p 3005` y entrar al panel.
- [ ] **Paso 2**: subir una **foto vertical de celular** en Contenido. Confirmar
      que la vista previa sale derecha y que las medidas que muestra el campo
      son las verticales. Es el bug del contexto: sin esto no está arreglado.
- [ ] **Paso 3**: confirmar en la base qué quedó:
      `select key, mime, bytes, width, height, original_name from media;`
      El `mime` tiene que ser `image/webp` y `bytes` un orden de magnitud menos
      que el archivo original.
- [ ] **Paso 4**: abrir `/media/img/<hash>.webp` derecho en el navegador y
      confirmar que sirve la imagen con `content-type: image/webp`.
- [ ] **Paso 5**: subir un PNG con transparencia y confirmar que el alfa
      sobrevive y los bordes no quedan sucios.
- [ ] **Paso 6**: subir un archivo que no sea imagen (un `.pdf` renombrado a
      `.jpg`) y confirmar que el mensaje de error es el de la allowlist.
- [ ] **Paso 7**: mirar `/eventos` en la tienda con una foto subida, para
      confirmar que `next/image` sigue optimizando sobre el WebP ya comprimido.

## Migraciones

**Ninguna.** El plan no toca `lib/db/schema.ts`: `media` ya tiene `mime`,
`bytes`, `width` y `height`, y lo único que cambia es qué valores se escriben.

## Cierre

- [x] `npx tsc --noEmit`
- [x] `npm run build` (con el `dev` bajado)
- [ ] Probado a mano en `:3005`
- [ ] Confirmar que `media` está vacío **en producción**. Si tiene filas,
      decidir ahí si se backfillea o se dejan como están (decisión 9).
- [ ] PR mergeado a `main`
- [ ] `./scripts/worktree.ps1 borrar media-gateway -borrarRama`

## Review

Hecho el 2026-08-25. Las tres primeras tareas están completas, `tsc` y
`npm run build` en verde, y el camino entero verificado sin navegador (ver
"Cómo se verificó"). Falta el click-test y confirmar producción.

### Qué cambió respecto del plan

1. **`normalizarImagen()` se llama `prepararImagen()`.** Al terminar la Tarea 2
   apareció que `lib/content/get.ts` ya tiene una `normalizarImagen` privada
   —parte de la familia `normalizarValor`/`normalizarImagen`/`normalizarLista`,
   que coacciona el JSON guardado a un `ImagenValor`—. Dos funciones con el
   mismo nombre y distinto significado **en la misma carpeta** es una trampa
   para el que llegue después. La que se movió fue la nueva, porque renombrar
   la de `get.ts` habría roto la coherencia de esa familia de tres.
2. **Apareció `lib/content/limites.ts`, que el plan no tenía.** Al armar los
   archivos de prueba se vio el agujero: un archivo de 31 MB **nunca llega a
   ejecutar la action**, porque antes lo corta el `bodySizeLimit` de Next. O
   sea que el mensaje amable de "el máximo son 10 MB" era inalcanzable justo
   para los archivos que más lo necesitan, y el botón se quedaba en "Subiendo…"
   para siempre. El tope y su mensaje viven ahora en un módulo que leen los dos
   lados: el servidor —donde vale, porque el cliente se puede editar— y el
   campo del panel, que frena antes de mandar nada. Es el mismo criterio con el
   que ya existe `esquema-imagen.ts`.
3. **`image-field.tsx` ganó un `try/catch`** alrededor de la action. Si la
   subida se corta antes de que conteste, ahora se ve un error en vez de un
   botón colgado. Era un agujero que ya existía, no lo trajo esta iteración.
4. **El texto del botón no se tocó** (Tarea 3, Paso 3), por lo que dice ahí.

### Un bug encontrado y arreglado durante la verificación

El techo de píxeles **no salta en el pipeline sino en `metadata()`**: libvips lo
controla apenas lee la cabecera. Con los dos `catch` separados que tenía la
primera versión, una bomba de 144 MP devolvía "puede estar dañada", que manda a
quien sube la foto a buscar el problema donde no está. Ahora los dos caminos
pasan por `comoIlegible()`, que traduce una sola vez.

### Cómo se verificó

Dos scripts de prueba, fuera del repo (son andamio, no código del proyecto):

- **Unitario sobre `prepararImagen`**, 20 chequeos, todos en verde: foto rotada
  por EXIF que sale vertical y con las medidas declaradas coincidiendo con las
  reales; EXIF ausente en la salida; tope de 2400; no agrandar; logo con alfa
  **píxel por píxel idéntico** al original (así se comprueba lo "sin pérdida",
  porque `metadata().isLossless` viene `undefined` en sharp 0.34.5); imagen con
  alfa de más de 1 MP que sí pierde; PDF renombrado rechazado por la allowlist;
  JPEG truncado que pasa la firma pero muere al decodificar; bomba de 144 MP
  rechazada con el mensaje correcto; y 49 MP —una cámara de gama alta— que sí
  pasa, para que el techo no sea demasiado celoso.
- **Round-trip real contra el bucket de producción y el build de producción**:
  preparar → `subirAlBucket` → traer y comparar bytes → fila en `media` →
  `GET /media/<key>` con su `content-type` y su `immutable` → **404 al borrar la
  fila** (la ruta no es un proxy abierto al bucket) → `/_next/image` sirviendo
  640 px en WebP sobre la imagen ya comprimida. La prueba **borra lo que sube**:
  termina con `DELETE 204` y `HEAD 404` contra el bucket, así que no quedó nada.

Lo único del camino de subida que no cubre ninguna de las dos es la cáscara de
`uploadMediaAction` —`requireUser`, `canEditContent` y el parseo del `FormData`—,
que no cambió en esta iteración.

Medición final, con el pipeline definitivo: **1.17 MB / 4032×3024 → 129 KB /
1800×2400**, derecha y sin metadatos.

### Qué queda pendiente

- **El click-test en el navegador** (Tarea 4). Hay fotos de prueba generadas
  para eso: una vertical de celular con EXIF, la misma apaisada, un logo con
  transparencia, un PDF renombrado a `.jpg` y un archivo de 31 MB.
- **Confirmar que `media` está vacío en producción.** En la base compartida
  hay 0 filas. Si producción tiene alguna, decidir según la decisión 9.
- **Nada de esto bloquea el merge**: lo verificado cubre el comportamiento, y
  lo que falta es la confirmación visual.
