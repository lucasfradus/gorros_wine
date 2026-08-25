# Plan actual

> Este archivo tiene **el** plan en curso, no la lista de todo lo que existe.
> Al cerrar una iteración, su plan se archiva en `docs/planes/` y esto se vacía.
>
> Antes de tocar código: leer `AGENTS.md` (este Next.js y este Drizzle no son
> los del training data) y `tasks/lessons.md`.

## ABM de eventos

Las nueve tareas hechas, `tsc` y `build` en verde. El plan completo —contexto,
decisiones y review— está en
[docs/planes/2026-08-25-eventos.md](../docs/planes/2026-08-25-eventos.md).

**Falta para cerrarlo:**

1. Probar el panel a mano en el navegador, con los dos roles. La tienda ya se
   verificó por HTTP, con fechas y sin fechas.
2. Correr `APPLY=1 node scripts/_eventos-seed.mjs` **en producción** después
   del deploy, o la página de eventos sale al aire vacía.
3. `./scripts/worktree.ps1 borrar eventos -borrarRama`.

## Lo que dejó pendiente el CMS

- Cargar las variables `S3_*` en el servicio de producción. Sin eso no se
  pueden subir imágenes: ni de contenido, ni de catálogo, ni de eventos.

## Lo que dejó pendiente el catálogo

Plan archivado en
[docs/planes/2026-08-25-admin-catalogo.md](../docs/planes/2026-08-25-admin-catalogo.md).

- **El campo de imagen del catálogo.** Las columnas `logo_key` e `imagen_key`
  ya están; falta sumar el campo a `bodega-forms.tsx` y `producto-forms.tsx`.
  Ahora es más corto de lo que decía ese plan: `ImageField` y
  `uploadMediaAction` ya no viven en `contenido/`, están en la raíz del panel
  justamente para que los use cualquier sección. Sin migración.
- **Cablear la tienda pública al catálogo de la base**: hoy `/catalogo`,
  `/producto/[id]`, `/buscar` y la home siguen leyendo `lib/data.ts`. Es la
  iteración que viene, y de las grandes. Los eventos ya hicieron ese camino en
  chico: mirar `lib/eventos.ts` antes de arrancar, sobre todo lo del caché.
