# Plan actual

> Este archivo tiene **el** plan en curso, no la lista de todo lo que existe.
> Al cerrar una iteración, su plan se archiva en `docs/planes/` y esto se vacía.
>
> Antes de tocar código: leer `AGENTS.md` (este Next.js y este Drizzle no son
> los del training data) y `tasks/lessons.md`.

# CMS de contenido estático

**Objetivo:** que el dueño pueda cambiar desde el panel todos los textos y las
imágenes fijas del sitio —hero, Nosotros, Club, Eventos, footer, age gate,
legales y los títulos de SEO— sin tocar código ni esperar un deploy.

**Enfoque:** una tabla clave/valor (`content`) más un **registro tipado** en
código que declara qué campos existen, cómo se llaman en castellano y cuál es
su texto original. Los originales viven en el registro, así que la base guarda
sólo lo que alguien editó: si una fila falta, el sitio muestra el texto de hoy.
El panel se genera solo a partir del registro. Las imágenes van a un bucket S3
de Railway y se sirven proxeadas por una ruta propia.

**Worktree:** `../Gorros-cms-contenido` · rama `feat/cms-contenido` · puerto `:3001`

---

## Contexto

Hoy todo el copy del sitio está escrito a mano en dos lugares: literales JSX
dentro de los componentes (`hero.tsx`, `about-teaser.tsx`, la página de
Nosotros) y arrays exportados desde `lib/data.ts` (beneficios, valores, pasos,
reseñas, datos del local). Cambiar "Lun a Sáb · 10 a 21 hs" exige editar
TypeScript, commitear y desplegar.

Las fotos están peor: sólo existe `public/hero-home.webp`. Todo el resto son
`<PhotoSlot>`, huecos rayados que dicen "Foto del local o del equipo". No hay
forma de subir una imagen sin pasar por el repo.

El panel ya tiene lo necesario para colgar esto: sesión en base, roles y la
receta de `docs/COMO-AGREGAR-MODULO.md`. El rol `editor` existe justamente
para esto y hoy no tiene ninguna pantalla propia.

## Decisiones ya tomadas (NO volver a preguntar)

1. **Alcance: todo el copy estático.** Home, Nosotros, Club, Eventos, footer,
   age gate, legales y la metadata de SEO por página.
2. **Imágenes en un bucket de Railway (S3).** El proyecto `gorros-wine`
   (`701cc4ab-…`) todavía no tiene bucket: hay que crearlo.
3. **Los buckets de Railway son privados** y no existen los públicos. Las
   imágenes se sirven **proxeadas** por una ruta propia (`/media/...`), no con
   URLs presignadas: una URL que vence no sirve para una página cacheada.
4. **Listas con agregar y quitar**, no slots fijos. Tipo de campo `lista` con
   forma de ítem declarada, `min`/`max` y reordenamiento.
5. **Los textos originales viven en el registro, en código.** La base guarda
   sólo lo editado. Un `content` vacío ⇒ el sitio se ve exactamente como hoy.
6. **Lo edita cualquiera del panel**, incluido `editor`. La regla vive en
   `canEditContent()`, no desparramada por la UI.

## Fuera de alcance

- Catálogo de vinos y ABM de eventos: siguen en `lib/data.ts`. Sólo entra el
  copy que los **rodea** (el encabezado de /eventos, no los eventos).
- Biblioteca de medios reutilizable, recorte de imágenes, versiones/historial,
  previsualización y borradores. La imagen se sube en el campo donde se usa.
- Multiidioma.
- Borrado de imágenes huérfanas del bucket (queda un script `_` para después).

---

## Tarea 0: worktree — hecha

- [x] Worktree `../Gorros-cms-contenido`, rama `feat/cms-contenido`, puerto
      `:3001`, dependencias instaladas.
- [x] De paso, arreglado `scripts/worktree.ps1`: git y npm escriben en stderr
      aunque les vaya bien, y con `ErrorActionPreference = 'Stop'` eso abortaba
      el script a mitad de camino (worktree sin puerto, sin `.env.local` y sin
      `node_modules`). **Ese arreglo quedó en `main`, sin commitear.**
- [ ] `npm i aws4fetch` (firma SigV4 sobre `fetch`, ~6 KB).

## Tarea 1: schema y migración

**Archivos:** modificar `lib/db/schema.ts`

- [ ] Tabla `content`: `key` (text, PK, ej. `home.heroTitle`), `value` (jsonb),
      `updatedAt`, `updatedBy` → `users.id` con `onDelete: "set null"`.
- [ ] Tabla `media`: `id` (uuid), `key` (text unique, `img/<sha256-12>.<ext>`),
      `mime`, `bytes`, `width`, `height`, `originalName`, `createdAt`,
      `createdBy`.
- [ ] `npm run db:generate` + `npm run db:migrate`. Es **aditiva**: no rompe a
      los otros worktrees que comparten la base.
- [ ] **Verificar**: `npm run db:studio` muestra las dos tablas vacías.

## Tarea 2: el registro

**Archivos:** crear `lib/content/types.ts`, `lib/content/registry.ts`

- [ ] Tipos de campo: `texto`, `parrafo`, `rico`, `imagen`, `lista`.
- [ ] Cada campo declara `label`, `help` y su `original` (el texto de hoy).
- [ ] Valor de `imagen`: `{ key, alt, width, height } | null`, desnormalizado
      a propósito — leer la home es **una** consulta, sin join contra `media`.
- [ ] Cada grupo declara `label`, `help` y `revalidate: string[]`.
- [ ] Grupos: `local`, `home`, `nosotros`, `club`, `eventos`, `footer`, `edad`,
      `legalesPrivacidad`, `legalesTerminos`. El SEO va como campos del grupo.
- [ ] Tipos derivados con `as const satisfies`, para que `getContent("home")`
      devuelva un objeto tipado.
- [ ] Volcar el copy exacto de hoy, sin reescribirlo.
- [ ] **Verificar**: `npx tsc --noEmit` en verde.

## Tarea 3: lectura

**Archivos:** crear `lib/content/get.ts`

- [ ] `getAllContent()` — una consulta, envuelta en `unstable_cache` con tag
      `contenido`. Sin esto la home deja de ser estática: sería una regresión.
- [ ] `getContent(grupo)` — mezcla originales con lo editado, tipado, con
      `cache()` de React para no consultar dos veces por request.
- [ ] Valor guardado que no valida ⇒ **cae al original**, no rompe la página.
- [ ] **Verificar**: la home renderiza igual que hoy con `content` vacío.

## Tarea 4: bucket e imágenes

**Archivos:** crear `lib/content/bucket.ts`, `lib/content/image-size.ts`,
`app/media/[...key]/route.ts`; modificar `next.config.mjs`, `.env.example`

- [ ] Crear el bucket en el proyecto `gorros-wine` de Railway.
- [ ] Variables `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`,
      `S3_REGION`, `S3_ENDPOINT`. **Confirmar en Credentials si el bucket es
      virtual-hosted o path-style.**
- [ ] `bucketReady()`: sin credenciales, subir da error claro y `/media/*` da
      404. El proyecto sigue levantando en local sin bucket.
- [ ] `image-size.ts`: ancho y alto de la cabecera (PNG IHDR, JPEG SOFn, WebP).
- [ ] `app/media/[...key]/route.ts`: busca la `key` en `media` (404 si no está,
      así no es un proxy abierto), la trae firmada y la devuelve con
      `Cache-Control: public, max-age=31536000, immutable`.
- [ ] `next.config.mjs`: `serverActions.bodySizeLimit` (el default es 1 MB).
- [ ] **Verificar**: subir un `.webp`, ver la fila en `media`, abrir la URL.

## Tarea 5: la sección Contenido del panel

**Archivos:** crear `app/(admin)/admin/(panel)/contenido/*`; modificar
`lib/auth/permissions.ts`, `lib/auth/index.ts`, `nav-links.tsx`, `page.tsx`

Sigue la receta de `docs/COMO-AGREGAR-MODULO.md`.

- [ ] `canEditContent()` y `requireContentEditor()`.
- [ ] `actions.ts` — **autorizar → validar → escribir → revalidar**:
      `saveGroupAction` (zod armado desde el registro, upsert por campo, borra
      lo que volvió al original, `revalidateTag` + `revalidatePath`),
      `uploadMediaAction` (mime y tamaño, sha256, reusa si ya existe),
      `resetFieldAction`.
- [ ] `page.tsx` — índice con una tarjeta por grupo.
- [ ] `[grupo]/page.tsx` — formulario generado desde el registro.
- [ ] `content-form.tsx` — despacha por tipo, marca lo editado, restaurar.
- [ ] `list-editor.tsx` — agregar, quitar, reordenar; respeta `min`/`max`.
- [ ] `image-field.tsx` — subida, vista previa, texto alternativo, quitar.
- [ ] `contenido.module.css` con los tokens de `globals.css`.
- [ ] Enlace en `nav-links.tsx` y tarjeta en el inicio del panel.
- [ ] **Verificar**: editar el hero con los **tres roles** y verlo en `:3001`.

> **Hito**: con las tareas 0–5 el CMS ya es usable de punta a punta.

## Tarea 6: cablear la tienda

- [ ] `home` → `hero`, `benefits`, `club-band`, `home-events` (encabezado y
      galería; los eventos siguen en `lib/data.ts`), `about-teaser`, `reviews`,
      `how-to-buy`.
- [ ] `nosotros`, `club`, `eventos` → sus páginas.
- [ ] `footer` y `local` → `footer.tsx`.
- [ ] `edad` → `age-gate.tsx` por props desde `app/(store)/layout.tsx` (es
      `"use client"`: no puede leer la base).
- [ ] `local` reemplaza a `shop` donde se arman los enlaces de WhatsApp y mail.
- [ ] Con imagen cargada, `<Image>` a `/media/...`; sin imagen, el `PhotoSlot`
      de siempre. El hueco rayado pasa a ser **fallback**, no estado permanente.
- [ ] Limpiar de `lib/data.ts` lo migrado, dejando vinos y eventos.
- [ ] **Verificar**: `npm run build` y comparar contra `main` con `content`
      vacío — tiene que verse **idéntico**.

## Tarea 7: legales

- [ ] Campo `rico` con formato mínimo: línea en blanco separa párrafos, `## `
      subtítulo, `- ` viñeta, `**negrita**`, `[texto](url)`. Nada más.
- [ ] `components/rich-text.tsx` renderiza a **nodos de React**, nunca con
      `dangerouslySetInnerHTML`: sin parser de HTML no hay superficie de XSS.
- [ ] Volcar privacidad y términos, con el aviso de borrador también editable.
- [ ] **Verificar**: las dos páginas se ven igual que hoy.

## Tarea 8: SEO

- [ ] `export const metadata` → `generateMetadata()` leyendo el grupo.
- [ ] **Verificar**: `<title>` y `<meta name="description">` en el HTML servido.

## Tarea 9: cierre

- [ ] Archivar este plan en `docs/planes/2026-08-24-cms-contenido.md`.
- [ ] `docs/ARQUITECTURA.md`: sumar el CMS al mapa.
- [ ] `docs/COMO-AGREGAR-MODULO.md`: cómo se agrega un campo al registro.
- [ ] `npx tsc --noEmit`, `npm run build`, probado con los tres roles.
- [ ] PR a `main` y `./scripts/worktree.ps1 borrar cms-contenido -borrarRama`.

## Review

_(Al terminar: qué se hizo, qué quedó afuera, qué habría que mirar después.)_
