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
└── (admin)/              panel — su propio layout, sin nav de tienda
    └── admin/
        ├── login/        pantalla de ingreso
        └── (panel)/      todo lo que exige sesión
            ├── page.tsx  inicio del panel
            ├── usuarios/ alta, edición, roles, activar/desactivar
            └── cuenta/   mi perfil y cambio de contraseña
```

## De dónde salen los datos

Hoy conviven dos fuentes, y conviene tenerlo claro:

- **El catálogo de vinos vive en `lib/data.ts`**, como un array de TypeScript.
  No está en la base. Es la razón por la que `/catalogo` y las fichas se pueden
  generar estáticas.
- **La base sólo tiene `users` y `sessions`** (`lib/db/schema.ts`): existe para
  el panel, no para la tienda.

Mover el catálogo a la base es una iteración pendiente, y de las grandes: toca
schema, panel de edición y render de la tienda. Va en worktree.

## Autenticación y permisos

Tres capas, y sólo una de ellas es control de acceso:

1. **`middleware.ts`** — corre en Edge, no puede consultar Postgres. Sólo mira si
   *existe* la cookie para redirigir rápido a `/admin/login`. **No es seguridad.**
2. **`lib/auth/index.ts`** — `requireUser()` y `requireUserManager()` validan
   contra la base. Es el punto único de verdad, y va tanto en la página como en
   la Server Action. Nunca alcanza con ponerlo en una sola de las dos.
3. **`lib/auth/permissions.ts`** — quién puede qué, en funciones puras
   (`canManageUsers`, `canEditUser`, `canAssignRole`).

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
| `owner` | Todo, incluido nombrar otros dueños |
| `admin` | Contenido y usuarios, pero no toca a los `owner` |
| `editor` | Sólo contenido. No ve la sección Usuarios |

Dos invariantes que el código defiende explícitamente: **siempre queda al menos
un `owner` activo**, y **nadie se cambia el rol ni se desactiva a sí mismo**.

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
| `scripts/create-admin.ts` | Crear el primer dueño, o recuperarlo si quedó afuera |
| `scripts/_*.ts` | One-off temporales. Dry-run por defecto, escriben sólo con `APPLY=1` |

```powershell
npm run db:up         # base local en :5432
npm run db:migrate    # aplicar migraciones
npm run admin:crear   # primer dueño
npm run dev           # http://localhost:3000
```
