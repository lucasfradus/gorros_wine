@AGENTS.md

# Cómo se trabaja en Gorros Wine

## 0. Worktree por iteración grande

Toda iteración que no sea un retoque va en **su propio worktree**, con su rama y
su puerto. No se trabaja semanas sobre `main` ni se mezclan dos features en el
mismo árbol.

- Abrir: `./scripts/worktree.ps1 nuevo <slug>` → crea `../Gorros-<slug>` desde
  `origin/main`, con su `.env.local` y un puerto libre.
- Rama: `feat/<slug>` o `fix/<slug>`. **Base siempre `origin/main`.**
- La base de datos es **una sola y compartida** (docker `gorros-db`, :5432).
- Cerrar: PR → merge a `main` → `./scripts/worktree.ps1 borrar <slug>`.

**Cuándo abrir uno**: toca el schema, suma 3+ archivos, o va a quedar a medio
terminar entre sesiones. Para un texto o un color, no: eso va directo a `main`.

Detalle completo — puertos, migraciones concurrentes, limpieza — en
[docs/WORKTREES.md](docs/WORKTREES.md).

## 1. Planificar primero

- Entrar en plan mode ante cualquier tarea no trivial (3+ pasos o una decisión
  de arquitectura).
- El plan va a `tasks/todo.md` con checkboxes, y se confirma antes de tocar código.
- Si algo se tuerce a mitad de camino: **frenar y replanificar**, no seguir
  empujando.
- Las iteraciones grandes llevan su plan fechado en `docs/planes/AAAA-MM-DD-slug.md`
  (formato en [docs/planes/PLANTILLA.md](docs/planes/PLANTILLA.md)). El plan tiene
  que ser autocontenido: quien lo ejecute no debería necesitar releer esta charla.

## 2. Subagentes

- Usarlos sin culpa para mantener limpio el contexto principal.
- Investigación, exploración y análisis en paralelo se delegan.
- Una tarea por subagente.

## 3. Loop de lecciones

- Después de **cualquier corrección del usuario**: anotar el patrón en
  `tasks/lessons.md` con el formato **Regla / Por qué / Cómo aplicar**.
- La lección se escribe como una regla para el futuro, no como un relato de lo
  que pasó.
- Leer `tasks/lessons.md` al empezar una sesión.

## 4. Verificar antes de dar algo por terminado

- Nada se marca como hecho sin demostrarlo: `npx tsc --noEmit`, `npm run build`,
  o la pantalla andando en el navegador.
- Cuando el cambio es de comportamiento, comparar contra `main`.
- La pregunta de control: *¿esto lo aprobaría un dev senior?*

## 5. Exigir elegancia (con medida)

- En cambios no triviales, frenar y preguntarse si hay una forma más simple.
- Si un arreglo se siente hacky, rehacerlo bien sabiendo lo que ya se sabe.
- En arreglos obvios, saltear este paso: no sobre-diseñar.

## 6. Arreglar bugs de forma autónoma

- Ante un reporte de bug: arreglarlo. No pedir que lo expliquen paso a paso.
- Con un log, un error o un test roto alcanza para investigar y resolver.

## Gestión de tareas

1. **Planificar**: escribir el plan en `tasks/todo.md` con ítems marcables.
2. **Confirmar**: repasarlo con el usuario antes de implementar.
3. **Avanzar**: ir marcando los ítems a medida que se completan.
4. **Explicar**: resumen de alto nivel en cada paso.
5. **Cerrar**: sección *Review* al final de `tasks/todo.md`.
6. **Capitalizar**: actualizar `tasks/lessons.md` con cada corrección.

## Principios

- **Simplicidad primero**: el cambio más simple que resuelva el problema.
- **Sin pereza**: buscar la causa de fondo. Nada de parches temporales.
- **Impacto mínimo**: tocar sólo lo necesario.

## Convenciones del repo

- **Server Actions** en `actions.ts` junto a la página que las usa, con
  `"use server"`, validación con **zod** y `revalidatePath` al final.
- **Autorización siempre contra la base**, en la action y en la página, vía
  `requireUser()` / `requireUserManager()` de `lib/auth`. El middleware sólo
  redirige; no es control de acceso.
- **Reglas de permisos** centralizadas en `lib/auth/permissions.ts`. No repetir
  comparaciones de rol sueltas por la UI.
- **Acceso a datos** con Drizzle desde `lib/db`. Nada de SQL suelto en un
  componente.
- **Estilos** con CSS Modules (`x.module.css`) y los tokens de `app/globals.css`.
  No hardcodear colores.
- **Comentarios**: en castellano y explicando **por qué**, no qué. El código ya
  dice qué hace. Mirá `lib/auth/session.ts` como referencia del tono.
- **Scripts** en `scripts/`. Los one-off que escriben datos van con prefijo `_`,
  hacen *dry-run* por defecto y sólo escriben con `APPLY=1`.
