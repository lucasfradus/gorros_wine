# <Título de la iteración> — Plan

> **Para quien lo ejecute**: este plan es autocontenido. Todo el contexto
> necesario está acá; no hace falta releer la conversación donde se decidió.
> Antes de tocar código, leer `AGENTS.md` y `tasks/lessons.md`.
> Los pasos van con checkbox (`- [ ]`) y se marcan a medida que avanzan.

**Objetivo:** una frase. Qué queda funcionando cuando esto esté hecho.

**Enfoque:** dos o tres frases sobre cómo se resuelve. Dónde vive la lógica
nueva, qué componente la usa, qué se toca de lo que ya existe.

**Worktree:** `../Gorros-<slug>` · rama `feat/<slug>` · puerto `:<puerto>`

---

## Contexto

Por qué se hace esto. Qué problema tiene hoy el sistema, con el caso concreto que
lo disparó. Si hay un bug, cómo se reproduce.

## Mapa del código actual

Tabla de dónde está cada cosa que este plan va a tocar. Sirve para no salir a
buscar lo mismo dos veces.

| Qué | Dónde |
| --- | --- |
| Ejemplo: sesión y cookies | [lib/auth/session.ts](../../lib/auth/session.ts) |

## Decisiones ya tomadas (NO volver a preguntar)

1. …
2. …

## Fuera de alcance

Lo que explícitamente **no** entra en esta iteración, para que no se filtre a
mitad de camino.

---

## Archivos

- **Crear** `ruta/nueva.ts` — qué contiene y por qué es un archivo aparte.
- **Modificar** `ruta/existente.ts` — qué se le agrega.
- **Borrar** `ruta/vieja.ts` — qué lo reemplaza.

---

## Tarea 1: <nombre>

**Archivos:** crear `…`, modificar `…`

- [ ] **Paso 1**: …
- [ ] **Paso 2**: …
- [ ] **Verificar**: `npx tsc --noEmit` en verde y <la comprobación concreta:
      qué pantalla, qué se ve, qué se guarda en la base>.

## Tarea 2: <nombre>

- [ ] …

---

## Migraciones

Si el plan toca `lib/db/schema.ts`:

- [ ] `npm run db:generate` — el SQL queda en `drizzle/` y se commitea.
- [ ] ¿Es aditiva? Si borra o renombra columnas, ver la sección de migraciones
      de [WORKTREES.md](../WORKTREES.md): la base es compartida entre worktrees.

## Cierre

- [ ] `npx tsc --noEmit`
- [ ] `npm run build`
- [ ] Probado a mano en `:<puerto>`
- [ ] PR mergeado a `main`
- [ ] `./scripts/worktree.ps1 borrar <slug> -borrarRama`

## Review

_(Qué se hizo, qué cambió respecto del plan y por qué, qué quedó pendiente.)_
