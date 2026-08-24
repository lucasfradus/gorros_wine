# Trabajar por worktree

Una iteración grande no se hace sobre `main`. Se abre un worktree: una copia del
repo enganchada a su propia rama, con su propio puerto, que vive al lado del
proyecto principal.

```
C:/Users/lucas/
├── Gorros/                  ← main            :3000
├── Gorros-checkout-mp/      ← feat/checkout-mp :3001
└── Gorros-admin-catalogo/   ← feat/admin-catalogo :3002
```

Son **hermanos** del repo y no carpetas adentro: así ni `next dev` ni `tsc` los
escanean, y no ensucian el `git status` del principal.

## Cuándo abrir uno

| Abrir worktree | Ir directo a `main` |
| --- | --- |
| Toca `lib/db/schema.ts` | Cambiar un texto o un color |
| Suma 3+ archivos nuevos | Arreglar un enlace roto |
| Va a quedar a medio hacer entre sesiones | Un typo |
| Hay que poder mostrar `main` andando mientras tanto | |

La regla corta: **si no lo terminás hoy, va en worktree.**

## Los tres comandos

```powershell
./scripts/worktree.ps1 nuevo checkout-mp          # rama feat/checkout-mp
./scripts/worktree.ps1 nuevo carrito-roto -tipo fix
./scripts/worktree.ps1 lista
./scripts/worktree.ps1 borrar checkout-mp -borrarRama
```

`nuevo` hace todo: rama desde `origin/main`, copia el `.env.local`, reserva un
puerto libre y corre `npm install` (con `-sinInstalar` lo saltea).

Después:

```powershell
cd ..\Gorros-checkout-mp
npm run dev -- -p 3001
```

## La base de datos es una sola

Todos los worktrees apuntan al mismo Postgres (`npm run db:up`, container
`gorros-db`, puerto 5432). Lo que cambia por worktree es sólo el puerto de Next.

Se eligió así porque tener una base por rama significa sembrar datos en cada una,
y en la práctica se termina probando contra una base vacía que no se parece a
nada. Con una sola base, lo que ves en un worktree es lo mismo que en `main`.

**El costo**: una migración aplicada en un worktree la ven todos. Antes de tocar
el schema:

1. Avisar (o acordarse) de que el resto de los worktrees van a ver ese cambio.
2. Preferir migraciones **aditivas**: agregar una columna nullable no rompe a
   nadie; renombrar o borrar una sí.
3. Si la migración es destructiva y hay otra rama viva, esa rama merece su propia
   base:

   ```powershell
   docker run -d --name gorros-db-<slug> -p 5433:5432 `
     -e POSTGRES_USER=gorros -e POSTGRES_PASSWORD=gorros_dev -e POSTGRES_DB=gorros `
     postgres:17-alpine
   ```

   y en el `.env.local` de ese worktree, `DATABASE_URL` a `localhost:5433`.

## Migraciones

```powershell
npm run db:generate    # escribe el SQL en drizzle/
npm run db:migrate     # lo aplica
```

El SQL generado **se commitea**. `drizzle-kit push` es sólo para prototipar en
local contra datos que no importan; nunca contra la base compartida con trabajo
de otra rama adentro.

## Cerrar la iteración

1. `npx tsc --noEmit` y `npm run build` en verde.
2. Commit y push de la rama.
3. PR contra `main`, merge.
4. `./scripts/worktree.ps1 borrar <slug> -borrarRama`.

`borrar` no usa `--force` a propósito: si quedó trabajo sin commitear, falla y te
avisa en vez de tragárselo. `-borrarRama` usa `git branch -d`, que sólo borra si
la rama ya está mergeada.

## Si algo queda colgado

```powershell
git worktree prune          # limpia registros de carpetas ya borradas a mano
git worktree list
```
