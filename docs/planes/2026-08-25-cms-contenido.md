# CMS de contenido estático — Plan

**Objetivo:** que el dueño pueda cambiar desde el panel todos los textos y las
imágenes fijas del sitio —hero, Nosotros, Club, Eventos, pie de página, age
gate, legales y los títulos de SEO— sin tocar código ni esperar un deploy.

**Enfoque:** una tabla clave/valor (`content`) más un **registro tipado** en
código que declara qué campos existen, cómo se llaman en castellano y cuál es
su texto original. Los originales viven en el registro, así que la base guarda
sólo lo que alguien editó: si una fila falta, el sitio muestra el texto de
siempre. El panel se genera solo recorriendo el registro. Las imágenes van a un
bucket S3 de Railway y se sirven proxeadas por una ruta propia.

**Worktree:** `../Gorros-cms-contenido` · rama `feat/cms-contenido` · puerto `:3001`

---

## Contexto

Todo el copy del sitio estaba escrito a mano en dos lugares: literales JSX
dentro de los componentes (`hero.tsx`, `about-teaser.tsx`, la página de
Nosotros) y arrays exportados desde `lib/data.ts` (beneficios, valores, pasos,
reseñas, datos del local). Cambiar "Lun a Sáb · 10 a 21 hs" exigía editar
TypeScript, commitear y desplegar.

Las fotos estaban peor: sólo existía `public/hero-home.webp`. Todo el resto eran
`<PhotoSlot>`, huecos rayados que decían "Foto del local o del equipo". No había
forma de subir una imagen sin pasar por el repo.

El panel ya tenía lo necesario para colgar esto: sesión en base, roles y la
receta de `docs/COMO-AGREGAR-MODULO.md`. El rol `editor` existe justamente para
esto y hasta ahora no tenía ninguna pantalla propia.

## Decisiones tomadas

1. **Alcance: todo el copy estático.** Home, Nosotros, Club, Eventos, pie de
   página, age gate, legales y la metadata de SEO por página.
2. **Imágenes en un bucket de Railway (S3).**
3. **Los buckets de Railway son privados** y no existen los públicos. Las
   imágenes se sirven **proxeadas** por `/media/[...key]`, no con URLs
   presignadas: una URL que vence no sirve para una página cacheada.
4. **Listas con agregar y quitar**, con `min`/`max` tomados del diseño.
5. **Los textos originales viven en el registro, en código.** La base guarda
   sólo lo editado.
6. **Lo edita cualquiera del panel**, incluido `editor`. La regla vive en
   `canEditContent()`.

## Fuera de alcance

- Catálogo de vinos y ABM de eventos: siguen en `lib/data.ts`. Sólo entró el
  copy que los **rodea**.
- Biblioteca de medios reutilizable, recorte de imágenes, versiones/historial,
  previsualización y borradores.
- Multiidioma.
- Borrado de imágenes huérfanas del bucket.

---

## Tarea 0: worktree

- [x] Worktree `../Gorros-cms-contenido`, rama `feat/cms-contenido`, `:3001`.
- [x] `npm i aws4fetch` (firma SigV4 sobre `fetch`, ~6 KB).
- [x] De paso, arreglado `scripts/worktree.ps1`: git y npm escriben en stderr
      aunque les vaya bien, y con `ErrorActionPreference = 'Stop'` eso abortaba
      el script a mitad de camino. **Ese arreglo se llevó a `main` aparte.**

## Tarea 1: schema y migración

- [x] Tabla `content`: `key` (PK), `value` (jsonb), `updatedAt`, `updatedBy`.
- [x] Tabla `media`: `key` única (`img/<sha256-16>.<ext>`), `mime`, `bytes`,
      `width`, `height`, `originalName`, `createdBy`.
- [x] `drizzle/0002_watery_dormammu.sql`, aditiva.
- [x] Verificado en `psql`: las dos tablas con sus claves y sus FK.

## Tarea 2: el registro

- [x] Tipos de campo: `texto`, `parrafo`, `rico`, `imagen`, `lista`.
- [x] Valor de `imagen`: `{ src, alt, width, height } | null`, desnormalizado a
      propósito — leer la home es **una** consulta, sin join contra `media`.
- [x] Diez grupos: `sitio`, `local`, `home`, `nosotros`, `club`, `eventos`,
      `footer`, `edad`, `legalesPrivacidad`, `legalesTerminos`.
- [x] Tipos derivados con `satisfies`: `getContent("home")` devuelve un objeto
      tipado, listas incluidas.
- [x] Volcado el copy exacto que ya estaba, sin reescribirlo.

## Tarea 3: lectura

- [x] `getAllContent()` en una consulta, envuelta en `unstable_cache` con el tag
      `contenido`, más `cache()` de React para deduplicar por request.
- [x] Un valor guardado que no valida **cae al original** en vez de romper.
- [x] Si la base no contesta, el sitio se sirve con los originales.

## Tarea 4: bucket e imágenes

- [x] Bucket `gorros-media` creado en el proyecto `gorros-wine` (región `sjc`,
      la misma del servicio). Credenciales en `.env.local`.
- [x] `bucketReady()`: sin credenciales el proyecto levanta igual, la subida da
      un error claro y `/media/*` responde 404.
- [x] `image-size.ts`: medidas leídas de la cabecera (PNG, JPEG con recorrido de
      segmentos, WebP en sus tres variantes). Verificado contra archivos reales.
- [x] `detectarFormato()` decide el mime **por los bytes**, no por lo que dice
      el navegador: ese mime es el `content-type` que devuelve `/media`.
- [x] `/media/[...key]` valida la clave contra `media` antes de tocar el bucket,
      y responde con un año de caché inmutable.
- [x] `serverActions.bodySizeLimit: "6mb"` (el default de Next es 1 MB).

## Tarea 5: la sección Contenido del panel

- [x] `canEditContent()` y `requireContentEditor()`.
- [x] `saveGroupAction` con el esquema zod **armado desde el registro**: upsert
      por campo, y borrado de la fila cuando el valor vuelve al original.
- [x] `uploadMediaAction`: valida tamaño y formato, calcula el sha256 y reusa la
      fila si esa imagen ya estaba subida.
- [x] Índice de secciones, formulario generado, editor de listas con agregar,
      quitar y reordenar, y campo de imagen con vista previa y texto alternativo.
- [x] "Restaurar el original" no necesita Server Action: el original viaja en el
      registro, así que es estado del cliente y al guardar se borra la fila.
- [x] Enlace en la navegación del panel y tarjeta en el inicio.

## Tarea 6: cablear la tienda

- [x] Home, Nosotros, Club, Eventos, pie de página y age gate leen del CMS.
- [x] `age-gate.tsx`, `cart-view.tsx` y `account-view.tsx` reciben lo que
      necesitan por props: son componentes de cliente y no pueden leer la base.
- [x] `<ContentImage>`: con foto cargada usa `next/image`; sin foto, el
      `<PhotoSlot>` de siempre. El hueco rayado pasó a ser **respaldo**.
- [x] Limpiados de `lib/data.ts` `shop`, `benefits`, `reviews`, `steps`,
      `values` y `pastEvents`.

## Tarea 7: legales

- [x] Campo `rico` con formato mínimo y propio, renderizado a nodos de React.
- [x] Privacidad y términos volcados al registro, con el aviso de borrador como
      campo editable: cuando el texto pase por un asesor, se vacía desde el panel.
- [x] `{direccion}`, `{horarios}`, `{email}`, `{instagram}` y `{whatsapp}` se
      completan solos desde "Datos del local", para que las legales no queden
      diciendo una dirección vieja.

## Tarea 8: SEO

- [x] `generateMetadata()` leyendo el grupo en Nosotros, Club, Eventos y las dos
      legales; el título y la descripción del sitio salen del grupo `sitio`.

---

## Migraciones

- [x] `drizzle/0002_watery_dormammu.sql`, aditiva: dos tablas nuevas, no toca
      `users` ni `sessions`.

## Cierre

- [x] `npx tsc --noEmit`
- [x] `npm run build` — y las páginas de la tienda **siguen siendo estáticas**.
- [x] Probado a mano en `:3001` con los dos roles.
- [x] Comparado contra `main` con la tabla vacía: **diez pantallas idénticas**,
      metadata incluida.
- [x] Bucket creado en Railway.
- [ ] Variables `S3_*` cargadas en el servicio `gorros-wine` de producción.
- [ ] PR mergeado a `main`.
- [ ] `./scripts/worktree.ps1 borrar cms-contenido -borrarRama`

## Review

**Qué se hizo.** El sitio dejó de tener copy escrito a mano. Todo el texto fijo
y todas las fotos estáticas se editan desde **Contenido**, en el panel, y el rol
`editor` —que hasta ahora no tenía dónde entrar— tiene su pantalla.

El corazón es `lib/content/registry.ts`: un archivo que declara qué se puede
editar, cómo se llama en castellano y qué dice hoy. De ahí salen tres cosas a la
vez: el formulario del panel (se genera recorriéndolo), los tipos que devuelve
`getContent()`, y el texto original de cada campo. Sumar un campo al sitio es
agregarlo ahí; no hay ninguna pantalla que tocar.

Que los originales vivan en código y no en un seed es la decisión que sostiene
todo lo demás: con `content` vacía el sitio se ve exactamente como se veía antes
—verificado pantalla por pantalla contra `main`—, un deploy nuevo no arranca en
blanco, "restaurar el original" es borrar una fila, y el copy sigue versionado
en git, que es donde se revisa por qué cambió.

**Cómo se verificó.** Con un navegador de verdad manejado por CDP, sin sumar
dependencias (Node 24 ya trae `WebSocket`):

- Editar el título del hero desde el panel como editor, guardar, y ver la fila
  en `content` con su autor, el texto nuevo en la portada, y la fila borrada al
  restaurar el original.
- Subir una foto: vista previa, fila en `media` con el mime detectado por bytes
  y las medidas leídas de la cabecera, `/media/...` devolviendo los mismos
  bytes con caché inmutable, y la portada mostrándola con su texto alternativo.
- Diez pantallas comparadas carácter por carácter contra `main` con la base
  vacía, más el `<title>` y la descripción de seis de ellas.

**Qué cambió respecto del plan.**

- **`main` se movió a mitad de camino**: reemplazó el rol `owner` por dos
  escalones y sumó su propia migración `0001`. Hubo que rebasar y renumerar la
  migración del CMS a `0002`. Es exactamente el escenario que advierte
  [WORKTREES.md](../WORKTREES.md).
- **No hizo falta `resetFieldAction`.** El original viaja en el registro, así que
  restaurar es estado del cliente y el borrado de la fila cae solo al guardar.
  Un endpoint menos que autorizar.
- **Se sumó el grupo `sitio`**, que no estaba en el plan: el título y la
  descripción con los que el sitio aparece en Google no son "datos del local"
  ni pertenecen a una página.
- **Apareció un bug real gracias a la prueba de punta a punta**: al enviar un
  formulario, el navegador convierte los saltos de línea de un `<textarea>` a
  CRLF. Como los originales del registro usan `\n`, **todo campo multilínea se
  guardaba siempre**, aunque nadie lo tocara, y "restaurar el original" no
  borraba nada. Lo arregla `normalizarSaltos()` en la action.

**Qué quedó afuera.**

- **Las variables `S3_*` en producción.** El bucket existe, pero el servicio
  `gorros-wine` todavía no las tiene. Conviene cargarlas por *referencia* a las
  del bucket (`${{gorros-media.BUCKET}}`) y no copiando los valores, así rotan
  solas. Hasta que estén, en producción se editan textos pero no se suben fotos.
- **No hay biblioteca de medios.** Cada foto se sube en el campo donde se usa y
  el texto alternativo se edita ahí. Reemplazar una imagen deja la anterior en
  el bucket: falta un script `_` que borre las huérfanas.
- **Sin previsualización, sin borradores y sin historial.** Se guarda y sale.
  Queda `updatedBy`/`updatedAt` por si algún día hace falta reconstruirlo.
- **El catálogo y los eventos siguen en `lib/data.ts`.** Sólo se migró el copy
  que los rodea.

**Qué habría que mirar después.**

- **Hay un tercer worktree tocando la misma base** (aparecieron `productos`,
  `bodegas` y `cotizaciones`). Su migración quedó aplicada en la base de
  desarrollo con un número que no está en esta rama: el que mergee segundo va a
  tener que renumerar. Vale la pena coordinarlo antes de abrir los dos PR.
- **El límite de 4 MB por imagen no comprime nada.** Una foto de celular moderna
  puede pasarlo, y ahí el mensaje pide achicarla a mano. Si molesta, el paso
  siguiente es redimensionar del lado del cliente antes de subir.
- **Los textos de los `<PhotoSlot>` se ven en el sitio público** mientras no haya
  foto, y uno de ellos todavía dice "Arrastrá una foto de un evento", que era una
  nota para quien diseñaba. Se dejó igual a propósito, para que esta iteración no
  cambiara ni una palabra de lo que se ve; conviene revisarlos cuando se carguen
  las fotos reales.
