# Plan actual

> Este archivo tiene **el** plan en curso, no la lista de todo lo que existe.
> Al cerrar una iteración, su plan se archiva en `docs/planes/` y esto se vacía.
>
> Antes de tocar código: leer `AGENTS.md` (este Next.js y este Drizzle no son
> los del training data) y `tasks/lessons.md`.

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
