# Cómo agregar una sección al panel

Receta para sumar una sección nueva al panel de administración (por ejemplo
Pedidos), respetando las convenciones que ya usan Usuarios, Bodegas, Productos y
Eventos. El código de acá es **hipotético y simplificado**: usa una tabla
`eventos` como ejemplo, pero no es el código real de esa sección ni de ninguna
otra. Los módulos de verdad están en
`app/(admin)/admin/(panel)/{usuarios,bodegas,productos,eventos}/` y son la
referencia que manda si algo no coincide.

Antes de arrancar: leer `AGENTS.md`, y si es una iteración grande, abrir worktree
(`./scripts/worktree.ps1 nuevo <slug>`) y escribir el plan en `docs/planes/`.

> **¿Es sólo un texto o una foto del sitio?** Entonces no hace falta nada de
> esto: se agrega un campo al registro del CMS. Ver
> [Sumar un campo al CMS](#sumar-un-campo-al-cms), al final.

## 1. Schema

En `lib/db/schema.ts`, con el mismo estilo que `users`: comentarios explicando
**por qué** existe cada campo raro, no qué es.

```ts
export const eventos = pgTable(
  "eventos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nombre: text("nombre").notNull(),
    /** En centavos: guardar plata en float termina en $1999.9999999. */
    precioCentavos: integer("precio_centavos").notNull(),
    /** Se archiva en vez de borrar, para no romper pedidos históricos. */
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("eventos_activos_idx").on(t.isActive)],
);

export type Evento = typeof eventos.$inferSelect;
export type NewEvento = typeof eventos.$inferInsert;
```

Migración:

```powershell
npm run db:generate     # el SQL queda en drizzle/ y se commitea
npm run db:migrate
```

La base es compartida entre worktrees: si la migración borra o renombra algo, ver
la sección de migraciones de [WORKTREES.md](WORKTREES.md).

## 2. Permisos

**Primero preguntarse si hace falta alguno.** Con dos roles, casi siempre no:
`ROLE_DESCRIPTION` dice que el `editor` maneja "catálogo, precios y eventos", así
que una sección de contenido la ven los dos y alcanza con `requireUser()`. Es lo
que hacen Bodegas y Productos: **no agregaron ninguna función de permiso.**
Inventar un permiso que siempre devuelve `true` es una indirección que después
hay que leer para descubrir que no hacía nada.

Si la sección **sí** es para algunos, la regla va en `lib/auth/permissions.ts`
como función pura, y nunca como comparaciones de rol sueltas por la UI:

```ts
/** ¿Ve la sección Pedidos? */
export function canManageOrders(actor: PublicUser): boolean {
  return actor.role === "admin";
}
```

Y el guard al lado de `requireUserManager()` en `lib/auth/index.ts`:

```ts
export async function requireOrderManager(): Promise<PublicUser> {
  const user = await requireUser();
  if (!canManageOrders(user)) redirect("/admin");
  return user;
}
```

## 3. Server Actions

`app/(admin)/admin/(panel)/eventos/actions.ts`. Siempre en este orden:
**autorizar → validar → reglas → escribir → revalidar**.

```ts
"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { eventos } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";

export interface EventoFormState {
  error?: string;
  ok?: string;
}

const esquema = z.object({
  id: z.uuid(),
  nombre: z.string().trim().min(2, "El nombre es muy corto."),
  precio: z.coerce.number().int().positive("El precio tiene que ser mayor a cero."),
});

export async function updateEventoAction(
  _prev: EventoFormState,
  formData: FormData,
): Promise<EventoFormState> {
  await requireUser();
  // Si la sección exigiera un permiso, iría acá — ver el punto 2.

  const parsed = esquema.safeParse({
    id: formData.get("id"),
    nombre: formData.get("nombre"),
    precio: formData.get("precio"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await db
    .update(eventos)
    .set({
      nombre: parsed.data.nombre,
      precioCentavos: parsed.data.precio * 100,
      updatedAt: new Date(),
    })
    .where(eq(eventos.id, parsed.data.id));

  revalidatePath("/admin/eventos");
  return { ok: "Cambios guardados." };
}
```

**La autorización va también en la action, no sólo en la página.** Una Server
Action es un endpoint HTTP: se puede invocar sin pasar por la pantalla que la
muestra.

Los mensajes de error son para quien los lee: "Ya hay una cuenta con ese mail",
no "constraint violation".

## 4. Páginas

```
app/(admin)/admin/(panel)/eventos/
├── page.tsx              listado
├── nuevo/page.tsx        alta
├── [id]/page.tsx         detalle y edición
├── actions.ts            Server Actions
└── evento-forms.tsx     componentes cliente ("use client")
```

La página también autoriza:

```tsx
export default async function EventosPage() {
  await requireUser();
  const filas = await db.select().from(eventos).orderBy(eventos.nombre);
  return <ListaEventos filas={filas} />;
}
```

El formulario, del lado cliente, con React 19:

```tsx
"use client";
import { useActionState } from "react";

const [state, action, pending] = useActionState(updateEventoAction, {});
```

## 5. Navegación

Sumar el enlace en `app/(admin)/admin/(panel)/nav-links.tsx`, condicionado por
permiso si la sección no es para todos.

## 6. Estilos

Antes de crear un `.module.css` nuevo, mirar `app/(admin)/admin/admin.module.css`:
ya tiene tarjeta, tabla, formulario, campos, pastillas, badges y botones, y es lo
que usan Usuarios, Bodegas y Productos. Sumarle lo que falte es mejor que abrir
una hoja aparte con la mitad repetida. Los colores salen siempre de los tokens de
`app/globals.css`; nada hardcodeado.

Lo mismo con los componentes: el cartel de resultado y el botón que se bloquea
al enviar ya viven en `app/(admin)/admin/(panel)/form-ui.tsx`.

## Sumar un campo al CMS

El caso más frecuente no es una sección nueva sino **un texto o una foto más** en
una pantalla que ya existe. Para eso no se toca ninguna pantalla del panel: se
agrega el campo a `lib/content/registry.ts` y el formulario aparece solo.

```ts
// en el grupo que corresponda, dentro de `campos`
heroPie: {
  tipo: "texto",              // texto | parrafo | rico | imagen | lista
  label: "Hero · pie",        // lo que se lee en el panel
  help: "La línea chica debajo del botón.",
  original: "Envíos en el día en Pilar",   // lo que dice hoy
},
```

Después, leerlo donde se use:

```tsx
const c = await getContent("home");
// ...
<p className={styles.pie}>{c.heroPie}</p>
```

Tres cosas que conviene tener presentes:

- **`original` es el texto que ya está en el código**, copiado tal cual. No es un
  ejemplo ni un placeholder: es lo que va a mostrar el sitio mientras nadie lo
  edite, y lo que devuelve "Restaurar el original".
- **El grupo declara qué invalidar** (`revalidate`, y `afectaTodo: true` si el
  campo se ve en el marco del sitio). Si eso queda mal, se edita y no se ve.
- **Renombrar un campo deja filas viejas en `content`.** No rompe nada —
  `get.ts` cae al original cuando el valor guardado no valida— pero la edición
  se pierde. Si el texto importa, migrar la fila a mano.

## 7. Verificar

- [ ] `npx tsc --noEmit`
- [ ] `npm run build`
- [ ] Probado con **los dos roles**, `admin` y `editor`. Que el editor no pueda
      hacer lo que no debe — y no sólo que no vea el botón. Una Server Action se
      puede invocar sin pasar por la pantalla.
- [ ] Actualizar `docs/ARQUITECTURA.md` si cambió el mapa general.
