# Plan actual

> Este archivo tiene **el** plan en curso, no la lista de todo lo que existe.
> Al cerrar una iteración, su plan se archiva en `docs/planes/` y esto se vacía.
>
> Antes de tocar código: leer `AGENTS.md` (este Next.js y este Drizzle no son
> los del training data) y `tasks/lessons.md`.

## ABM de eventos

El plan completo —contexto, decisiones tomadas, tareas y verificación— está en
[docs/planes/2026-08-25-eventos.md](../docs/planes/2026-08-25-eventos.md).
Los checkboxes se marcan **allá**, que es donde está el detalle de cada paso.

**Worktree:** `../Gorros-eventos` · rama `feat/eventos` · puerto `:3004`

| Tarea | Estado |
| --- | --- |
| 1. Tabla `eventos` y migración | ☑ |
| 2. Permisos (`canEditEvents`, `requireEventEditor`) | ☑ |
| 3. Mudar `ImageField` y `uploadMediaAction` a un lugar compartido | ☑ |
| 4. Fechas: `datetime-local` ↔ instante, con huso fijo | ☑ |
| 5. Server Actions (crear, editar, borrar) | ☑ |
| 6. Pantallas del panel | ☑ (falta prueba en navegador) |
| 7. Enlace en la navegación | ☑ |
| 8. La tienda lee la agenda real | ☐ |
| 9. Migrar los cuatro eventos de hoy | ☐ |

**Antes de escribir el formulario**, leer la sección de huso horario del plan:
`<input type="datetime-local">` entrega un string sin zona y el servidor de
producción corre en UTC. Es el error caro de esta iteración.

---

_Pendiente de la iteración anterior (CMS de contenido, ya mergeada en
`4e64455`): cargar las variables `S3_*` en el servicio de producción._
