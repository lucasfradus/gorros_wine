# Arquitectura

Sitio de la vinoteca **Gorros Wine** (Pilar, Buenos Aires): la tienda pública más
un panel de administración.

## Stack

| Pieza | Qué se usa |
| --- | --- |
| Framework | Next.js 15 — App Router, Server Components, Server Actions |
| Base de datos | PostgreSQL 17 + Drizzle ORM (`drizzle-kit` para migraciones) |
| Estilos | CSS Modules + tokens en `app/globals.css`. Sin framework de CSS |
| Tipografías | `next/font/google` (Fraunces + Jost), autoalojadas en el build |
| Autenticación | Propia: sesiones en base, cookie `gw_session`, bcrypt |
| Validación | zod v4 |
| Contenido | CMS propio: tabla clave/valor + registro tipado en `lib/content/` |
| Imágenes | Bucket S3 de Railway (privado), servidas por `/media/[...key]` |

Sin Prisma, sin NextAuth, sin Tailwind. Ver `AGENTS.md` antes de escribir código.

## Las dos mitades del sitio

Los grupos de rutas no aparecen en la URL; existen para darle a cada mitad su
propio layout.

```
app/
├── (store)/              público — fondo negro, nav, footer, age gate
│   ├── page.tsx          home
│   ├── catalogo/         grilla con filtros (?tipo=)
│   ├── producto/[id]/    ficha, SSG
│   ├── buscar/           por nombre, bodega, uva o región
│   ├── carrito/          pedido y subtotal
│   ├── club/  eventos/  nosotros/  cuenta/
│   └── terminos/  privacidad/
│
├── media/[...key]/       sirve las imágenes del CMS desde el bucket
│
└── (admin)/              panel — su propio layout, sin nav de tienda
    └── admin/
        ├── login/        pantalla de ingreso
        └── (panel)/      todo lo que exige sesión
            ├── page.tsx  inicio del panel
            ├── contenido/ textos e imágenes del sitio
            ├── usuarios/ alta, edición, roles, activar/desactivar
            └── cuenta/   mi perfil y cambio de contraseña
```

## De dónde salen los datos

Hoy conviven tres fuentes, y conviene tenerlo claro:

- **El catálogo de vinos vive en `lib/data.ts`**, como arrays de TypeScript. No
  está en la base. Es la razón por la que `/catalogo` y las fichas se pueden
  generar estáticas.
- **Los textos y las fotos del sitio salen del CMS** (ver abajo).
- **La base tiene `users`, `sessions`, `content`, `media` y `eventos`**
  (`lib/db/schema.ts`).

Mover el catálogo a la base es una iteración pendiente, y de las grandes: toca
schema, panel de edición y render de la tienda. Va en worktree.

## La agenda de eventos

Las catas y encuentros **sí** están en la base, desde la iteración del ABM. Se
cargan en **Eventos**, en el panel, y se leen con `lib/eventos.ts`.

Un evento es una fecha, no un rango: de `comienza` salen el día, el mes y la
hora que muestra la tarjeta. La tienda lista los próximos con botón de reserva
y, debajo, los seis últimos que ya pasaron, apagados y sin botón. El panel no
tiene ese tope, que es donde el histórico completo se viene a buscar.

Tres cosas que no son obvias:

- **La lectura va cacheada con el tag `eventos`, y además con un techo de
  quince minutos.** El tag cubre las ediciones del panel; el techo cubre el
  paso del tiempo, porque la agenda cambia **sola** —un evento pasa de próximo
  a pasado sin que nadie toque nada— y sin él una cata ya empezada seguiría
  anunciándose como próxima hasta la siguiente edición.
- **`unstable_cache` serializa a JSON: las `Date` vuelven como string.** Por eso
  `lib/eventos.ts` declara la frontera de forma explícita: lo que se cachea
  lleva `comienza` como ISO, y `getAgenda` es el único lugar que la reconvierte.
  Sin eso, la primera lectura funciona —caché frío, objeto tal cual salió de
  Drizzle— y la segunda rompe.
- **La hora se guarda y se lee siempre en la zona de Buenos Aires**, fija en
  `lib/format.ts`. El formulario usa `<input type="datetime-local">`, que
  entrega un string sin zona, y producción corre en UTC.

Los textos que rodean a la agenda —volanta, título, bajada, galería, el aviso
de "no hay fechas"— siguen siendo del CMS.

## El CMS de contenido

Todo el copy fijo del sitio —hero, Nosotros, Club, Eventos, pie de página, age
gate, legales y la metadata de SEO— se edita desde **Contenido** en el panel.

Tres piezas, en `lib/content/`:

| Archivo | Qué hace |
| --- | --- |
| `registry.ts` | Declara **qué** se puede editar y **qué dice hoy**. El único archivo que se toca para sumar un campo |
| `get.ts` | `getContent(grupo)` — mezcla lo editado con los originales, en una consulta cacheada |
| `bucket.ts` · `image-size.ts` | Subida al bucket S3 y medidas leídas de la cabecera del archivo |

Dos decisiones que explican el resto:

- **Los textos originales viven en el registro, no en un seed de la base.** La
  tabla `content` guarda **sólo lo que alguien cambió**: una fila por campo
  editado, no por campo del sitio. Con la tabla vacía el sitio se ve exactamente
  como vino con el diseño, un deploy nuevo no arranca en blanco, y "restaurar el
  original" es borrar la fila.
- **La lectura va envuelta en `unstable_cache` con el tag `contenido`.** Sin eso,
  leer contenido volvería dinámica cada página que hoy se prerenderiza. Guardar
  en el panel invalida el tag y las rutas que declara el grupo.

Las imágenes van a un bucket de Railway, que es **privado**: no hay URL pública.
Se sirven proxeadas por `app/media/[...key]/route.ts`, y la clave de cada archivo
es el hash de su contenido — por eso la ruta puede responder con un año de caché
inmutable sin riesgo de mostrar una foto vieja.

El formato de texto es mínimo y propio (`components/rich-text.tsx`): `*acento*`,
`**destacado**`, `## subtítulo`, `- viñeta`, `[texto](destino)`. Se renderiza a
nodos de React, nunca con `dangerouslySetInnerHTML`.

## Autenticación y permisos

Tres capas, y sólo una de ellas es control de acceso:

1. **`middleware.ts`** — corre en Edge, no puede consultar Postgres. Sólo mira si
   *existe* la cookie para redirigir rápido a `/admin/login`. **No es seguridad.**
2. **`lib/auth/index.ts`** — `requireUser()` y `requireUserManager()` validan
   contra la base. Es el punto único de verdad, y va tanto en la página como en
   la Server Action. Nunca alcanza con ponerlo en una sola de las dos.
3. **`lib/auth/permissions.ts`** — quién puede qué, en funciones puras
   (`canManageUsers`, `canEditContent`).

### Sesiones

En base, no JWT, y a propósito: una sesión en base **se puede revocar**. Se
desactiva un usuario y sus sesiones mueren en el acto; con un JWT firmado habría
que esperar a que venza.

`sessions.id` guarda el **SHA-256 del token**, no el token. Un dump filtrado de
la base no sirve para entrar a ningún lado. Duración: 30 días fijos, sin
renovación deslizante — Next sólo deja escribir cookies desde una Server Action
o un Route Handler, nunca desde el layout que hace la verificación.

### Roles

| Rol | Alcance |
| --- | --- |
| `admin` | Todo: contenido, catálogo y usuarios. Puede nombrar otros admin |
| `editor` | Sólo contenido del sitio. No ve la sección Usuarios |

Dos invariantes que el código defiende explícitamente: **siempre queda al menos
un `admin` activo**, y **nadie se cambia el rol ni se desactiva a sí mismo**.

## Server Actions

Van en un `actions.ts` al lado de la página que las usa. La forma es siempre la
misma:

```ts
"use server"

export async function accionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUserManager()          // 1. autorizar
  const parsed = esquema.safeParse({ ... })         // 2. validar con zod
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  // 3. reglas de negocio → { error } si no pasan
  await db.update(...)                              // 4. escribir
  revalidatePath("/admin/usuarios")                 // 5. revalidar
  return { ok: "Cambios guardados." }
}
```

El estado siempre es `{ error?: string; ok?: string }`, y el componente lo
consume con `useActionState` de React 19.

## Estilos

Un archivo `.module.css` por componente, al lado del `.tsx`. Los colores salen de
los tokens de `app/globals.css` (`--night`, `--gold`, `--heading`, `--text`,
`--muted`, `--dim`, `--chip`) — no se hardcodean.

## Scripts

| Script | Para qué |
| --- | --- |
| `scripts/worktree.ps1` | Abrir, listar y cerrar worktrees — ver [WORKTREES.md](WORKTREES.md) |
| `scripts/create-admin.mjs` | Crear el primer admin, o recuperarlo si quedó afuera |
| `scripts/migrate.mjs` | Aplicar migraciones en el deploy, sin dependencias de desarrollo |
| `scripts/_*.mjs` | One-off temporales. Dry-run por defecto, escriben sólo con `APPLY=1` |

```powershell
npm run db:up         # base local en :5432
npm run db:migrate    # aplicar migraciones
npm run admin:crear   # primer dueño
npm run dev           # http://localhost:3000
```
