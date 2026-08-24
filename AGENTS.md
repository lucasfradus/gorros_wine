# Avisos de stack

Antes de escribir código, leer esto. Varias de estas librerías cambiaron su API
respecto de lo que suele estar en el entrenamiento de un modelo.

## Next.js 15 — App Router

- `cookies()`, `headers()` y `params` son **asíncronos**: van con `await`.
  `const token = (await cookies()).get(...)`.
- Las cookies sólo se pueden **escribir** desde una Server Action o un Route
  Handler. Nunca desde un layout o una página. Por eso la sesión tiene
  vencimiento fijo y no deslizante (ver `lib/auth/session.ts`).
- Los grupos de rutas `(store)` y `(admin)` no aparecen en la URL: existen para
  darle a cada mitad del sitio su propio `layout.tsx`.
- El middleware corre en runtime **Edge**: no hay Postgres ni `node:crypto` ahí.
- Ante la duda, la documentación de la versión instalada está en
  `node_modules/next/dist/docs/`. Leer eso antes que recordar.

## Drizzle ORM — no es Prisma

- El schema es TypeScript (`lib/db/schema.ts`), no un `.prisma`. Los tipos salen
  de `$inferSelect` / `$inferInsert`.
- Las queries se arman con builder: `db.select().from(users).where(eq(...))`.
  No hay `findMany` ni `include`.
- Los filtros (`eq`, `and`, `ne`, `count`, `inArray`...) se importan de
  `drizzle-orm`, no cuelgan del objeto `db`.
- Migraciones con `drizzle-kit`: `npm run db:generate` escribe el SQL en
  `drizzle/`, `npm run db:migrate` lo aplica. `push` sólo para prototipar
  en local, nunca contra datos que importen.
- `drizzle.config.ts` carga `.env.local` a mano, porque drizzle-kit corre fuera
  de Next.

## Zod v4

- `z.email()` y `z.uuid()` son funciones sueltas del namespace. La forma vieja
  `z.string().email()` está deprecada.
- Los errores se leen de `parsed.error.issues[0].message`.

## React 19

- Los formularios usan `useActionState` (no el viejo `useFormState`) y el estado
  de la action tiene forma `{ error?: string; ok?: string }`.

## Postgres

- `pg` queda fuera del bundle vía `serverExternalPackages` en `next.config.mjs`.
- El pool se cachea en `globalThis` para sobrevivir al hot reload de dev.
