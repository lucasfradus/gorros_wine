# Plan actual

> Este archivo tiene **el** plan en curso, no la lista de todo lo que existe.
> Al cerrar una iteración, su plan se archiva en `docs/planes/` y esto se vacía.
>
> Antes de tocar código: leer `AGENTS.md` (este Next.js y este Drizzle no son
> los del training data) y `tasks/lessons.md`.

**Catálogo en la base: ABM de categorías, varietales, bodegas y productos.**
El plan completo —contexto, modelo, decisiones y review— está en
[docs/planes/2026-08-25-admin-catalogo.md](../docs/planes/2026-08-25-admin-catalogo.md).

Worktree `../Gorros-admin-catalogo` · rama `feat/admin-catalogo` · puerto `:3002`

- [x] **1. Worktree** — abierto en `:3002`.
- [x] **2. Schema y migración** — `bodegas`, `productos`, `cotizaciones`.
- [x] **3. Dominio y precios** — `lib/catalogo.ts`, `lib/precio.ts`,
      `lib/campos.ts`, `lib/cotizacion.ts`, `lib/categorias.ts`.
- [x] **5. ABM de Bodegas**
- [x] **6. ABM de Productos**
- [x] **7. Cotización** — historial del dólar, editable desde el listado.
- [x] **8. Navegación e inicio** — sección Catálogo y conteo real en el panel.
- [x] **9. Categorías** — con subcategorías; `esVino` decide qué ficha se pide.
- [x] **10. Varietales** — tabla con ABM propio y relación por tabla intermedia.
- [x] **11. Productos según la categoría** — campos de vino condicionales.
- [x] **Verificación** — `tsc`, `build`, y las pantallas y acciones probadas
      contra la base con sesión real. Detalle en el Review del plan.
- [x] **Rebase sobre `origin/main`**, ya con el CMS mergeado.
- [ ] **Cierre** — PR a `main` y `./scripts/worktree.ps1 borrar admin-catalogo
      -borrarRama`.

## Lo que dejó pendiente el CMS

- Cargar las variables `S3_*` en el servicio de producción. Sin eso no se
  pueden subir imágenes, ni de contenido ni —cuando se enchufe— de catálogo.

## Lo que deja pendiente esta iteración

- **El campo de imagen del catálogo.** Las columnas `logo_key` e `imagen_key`
  ya están; falta sumar el campo a `bodega-forms.tsx` y `producto-forms.tsx`
  reusando el `image-field.tsx` y el `uploadMediaAction` del CMS. Sin migración.
- **Cablear la tienda pública a la base**: hoy sigue leyendo `lib/data.ts`.
  Es la iteración que viene, y de las grandes.

## Review

Está en el plan archivable:
[docs/planes/2026-08-25-admin-catalogo.md](../docs/planes/2026-08-25-admin-catalogo.md#review).
