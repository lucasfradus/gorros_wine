# Plan actual

> Este archivo tiene **el** plan en curso, no la lista de todo lo que existe.
> Al cerrar una iteración, su plan se archiva en `docs/planes/` y esto se vacía.
>
> Antes de tocar código: leer `AGENTS.md` (este Next.js y este Drizzle no son
> los del training data) y `tasks/lessons.md`.

## Clientes y cuenta corriente

Worktree `../Gorros-clientes` · rama `feat/clientes` · puerto `:3003` · PR
[#3](https://github.com/lucasfradus/gorros_wine/pull/3).

El plan completo, con el modelo de datos, las decisiones tomadas y el Review
final, está en
[docs/planes/2026-08-25-clientes-cuenta-corriente.md](../docs/planes/2026-08-25-clientes-cuenta-corriente.md).

- [x] **Tarea 1** — Schema: tablas `clientes` y `movimientos_cc`, enum
      `movimiento_tipo`. Migración aditiva generada y aplicada.
- [x] **Tarea 2** — Permisos, formato de plata, `lib/cuenta-corriente.ts` (reglas)
      y `lib/db/cuenta.ts` (consultas).
- [x] **Tarea 3** — CRUD de clientes: listado con buscador y filtros, alta, ficha,
      archivar.
- [x] **Tarea 4** — Cuenta corriente: cargo, pago, conversión, ajuste y anulación.
- [x] **Tarea 5** — `docs/ARQUITECTURA.md` al día, con su sección propia.
- [x] **Rebase sobre `origin/main`** — cuatro veces: CMS, catálogo, eventos y el
      cierre del deploy. Migración regenerada cada vez; quedó en `0005`.

**Falta para cerrarlo:**

1. Probar los formularios haciendo clic en `:3003`, con los dos roles. Es lo
   único que no se pudo verificar sin un navegador; el resto está cubierto (ver
   el Review). Las tablas quedaron vacías, así que el primer cliente lo crea esa
   prueba.
2. Mergear el PR #3 y `./scripts/worktree.ps1 borrar clientes -borrarRama`.

**Deuda que deja:**

- **Unificar el formateo de plata.** Conviven `lib/precio.ts` (catálogo) y
  `formatARS`/`formatUSD`/`importeACentavos` (cuenta corriente). No es sólo
  duplicación: `formatearPrecio` **pierde el signo de los negativos**
  (`-50` → `"$0,50"`), y el dólar se muestra `US$` de un lado y `USD` del otro.
  El detalle y qué conservar de cada uno están en el Review del plan.

## ABM de eventos — desplegado

Mergeado en `a466bad` y andando en producción. El plan completo —contexto,
decisiones y review— está en
[docs/planes/2026-08-25-eventos.md](../docs/planes/2026-08-25-eventos.md).

Hecho el 2026-08-25 después del deploy:

- Migración `0004` aplicada (la corre sola el `preDeployCommand`).
- Los cuatro eventos sembrados en producción con
  `APPLY=1 node scripts/_eventos-seed.mjs`, corrido dentro del contenedor por
  `railway ssh`. `/eventos` y la home muestran la agenda.
- Las `S3_*` ya estaban cargadas y verificadas: coinciden con las credenciales
  reales del bucket y la firma se acepta. Ese pendiente del CMS está cerrado.

**Falta para cerrarlo:**

1. Probar el panel a mano en el navegador, con los dos roles. Es lo único de la
   iteración que no se verificó.
2. `./scripts/worktree.ps1 borrar eventos -borrarRama`.

## Pendiente nuevo: la agenda sale vacía por 15 minutos después de cada deploy

**Qué pasa.** `/eventos` y la home se prerenderizan en el build. El build de
Railway **no tiene acceso a la red privada** —por eso las migraciones corren
como `preDeployCommand` y no en el build—, así que la consulta a `eventos`
falla, `lib/eventos.ts` la atrapa y hornea una agenda vacía. La página queda
mostrando "Por ahora no tenemos fechas abiertas" hasta que vence el
`revalidate: 900` y la primera visita la regenera.

**Medido el 2026-08-25**: prerender de las 18:23 UTC, agenda visible a las
18:39:13. Quince minutos justos, con cuatro eventos publicados en la base.

**Por qué no se había visto**: el CMS usa el mismo patrón, pero cuando su
lectura falla cae a los textos originales del registro, que es lo que se quiere
igual. Acá el equivalente de "falló la lectura" es indistinguible de "no hay
eventos".

**Ojo con el arreglo**: bajar el `revalidate` acorta la ventana pero no la
elimina. Las opciones de fondo son sacar la agenda del prerender —que la lea
en la request, donde la base sí se alcanza— o no dejar que una lectura fallida
se cachee como si fuera un resultado válido. Es una decisión de diseño, y toca
las dos pantallas más importantes del sitio: va con plan.

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
  iteración que viene, y de las grandes. Antes de arrancar, resolver lo de
  arriba: el catálogo en la tienda va a pisar exactamente la misma piedra, y
  ahí el prerender vacío no es una agenda sin fechas sino un catálogo sin
  vinos.
