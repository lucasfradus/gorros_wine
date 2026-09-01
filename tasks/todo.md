# Plan actual

> Este archivo tiene **el** plan en curso, no la lista de todo lo que existe.
> Al cerrar una iteración, su plan se archiva en `docs/planes/` y esto se vacía.
>
> Antes de tocar código: leer `AGENTS.md` (este Next.js y este Drizzle no son
> los del training data) y `tasks/lessons.md`.

## Eventos: sacar el precio y la hora

Un evento pasa a ser un título, **un día**, un lugar, un detalle y una foto. El
plan completo —contexto, las seis decisiones tomadas y el Review— está en
[docs/planes/2026-09-01-eventos-campos.md](../docs/planes/2026-09-01-eventos-campos.md).

Worktree `../Gorros-eventos-campos` · rama `feat/eventos-campos` · puerto `:3007`

- [x] **Tarea 1** — Schema y migración. `comienza` de `timestamptz` a `date` en
      modo string, y fuera `precio_centavos`. La `0008` va editada a mano: el
      `ALTER` que genera drizzle falla sin el `USING`, y el `AT TIME ZONE` de
      adentro es lo que evita que una cata de las 21:00 se corra un día.
- [x] **Tarea 2** — `lib/format.ts` y `lib/eventos.ts`. Se van `formatHora`,
      `desdeInputLocal`, `aInputLocal`, los tres `Intl` de la agenda y la
      frontera `Date` ↔ `string` del `unstable_cache`. El corte próximos /
      pasados compara contra `hoyEnArgentina()`.
- [x] **Tarea 3** — Panel y tienda. Formulario con `type="date"` y sin Precio;
      listado sin la columna ni la hora; el botón queda `Reservar` a secas.
- [x] **Tarea 4** — Seed one-off actualizado y `docs/ARQUITECTURA.md` al día.
- [x] **Verificado** — `npx tsc --noEmit`, `npm run build`, y las tres pantallas
      leídas en `:3007` con eventos de ayer, hoy y mañana en la base: el de hoy
      queda en Próximos, ninguna fecha se corre un día, y la lectura con caché
      caliente devuelve lo mismo que la fría.

**Falta para cerrarlo:**

1. Abrir `:3007`, entrar al panel y **crear y editar un evento a mano**. Es lo
   único que no se pudo verificar: el POST de la Server Action no se reproduce
   con `curl` porque el encoding RSC de `useActionState` no se arma a mano. La
   validación de la fecha sí se comprobó aparte, contra los 744 días de un año
   bisiesto y uno normal.
2. Mergear el PR y `./scripts/worktree.ps1 borrar eventos-campos -borrarRama`.

**Ojo mientras tanto:** la migración ya está aplicada en la base compartida, así
que `main` y los otros worktrees rompen en las pantallas de eventos hasta que
esto se mergee.
