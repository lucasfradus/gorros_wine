# Plan actual

> Este archivo tiene **el** plan en curso, no la lista de todo lo que existe.
> Al cerrar una iteración, su plan se archiva en `docs/planes/` y esto se vacía.
>
> Antes de tocar código: leer `AGENTS.md` (este Next.js y este Drizzle no son
> los del training data) y `tasks/lessons.md`.

## Eventos: sacar el precio y la hora — desplegado

Mergeado en `67176a8` (PR #14) y andando en producción: deploy `SUCCESS`, la
migración `0008` corrida por el `preDeployCommand`. Un evento pasa a ser un
título, **un día**, un lugar, un detalle y una foto. El plan completo —contexto,
las seis decisiones y el Review— está en
[docs/planes/2026-09-01-eventos-campos.md](../docs/planes/2026-09-01-eventos-campos.md).

**Falta para cerrarlo:**

1. **Crear y editar un evento a mano en el panel.** Es lo único de la iteración
   que no se verificó: el POST de la Server Action no se reproduce con `curl`
   porque el encoding RSC de `useActionState` no se arma a mano. La validación
   de la fecha sí se comprobó aparte, contra los 744 días de un año bisiesto y
   uno normal.
2. Confirmar que la agenda de producción volvió después del `revalidate` (ver
   abajo).

## Viene de las iteraciones anteriores (sigue pendiente)

- **Diecinueve bodegas sin logo**: Antucura, De Angeles, Rimapere, Costa &
  Pampa, Altocedro, Abras, Teho, TintoNegro, Matías Riccitelli, Bressia, Manos
  Negras, Codorníu, Tapiz, LTU, Achaval Ferrer, Mil Demonios, Alandes, Fernando
  Dupont y Piatelli. Se agregan desde el panel.
- **Doce carpetas del Drive son portfolios** con varias marcas adentro. Hay que
  decidir qué es bodega y qué es marca antes de cargarlas.
- **`productos.imagen_key` sigue con la forma vieja** (texto con la key, sin
  usar). Cuando el catálogo sume su foto, conviene pasarlo a `jsonb`.
- **Cargar los logos invertidos en producción**: el mismo
  `scripts/_logos-tinta-clara.mjs` apuntando a Railway. Los bytes nuevos hay que
  subirlos, que es lo que el script hace.
- **Los logos originales de los 14 invertidos siguen en el bucket.** Es a
  propósito —son el camino de vuelta— pero nadie los va a limpiar nunca: no hay
  recolector de imágenes huérfanas, y el día que haya, tiene que saber de esto.
- **Unificar el formateo de plata.** Conviven `lib/precio.ts` (catálogo) y
  `formatARS` / `formatUSD` / `importeACentavos` (cuenta corriente). No es sólo
  duplicación: `formatearPrecio` **pierde el signo de los negativos**
  (`-50` → `"$0,50"`), y el dólar se muestra `US$` de un lado y `USD` del otro.
  El detalle y qué conservar de cada uno están en el Review de
  [docs/planes/2026-08-25-clientes-cuenta-corriente.md](../docs/planes/2026-08-25-clientes-cuenta-corriente.md).

## Sin resolver: la agenda de producción sale vacía

`/eventos` en producción no muestra **ningún** evento —ni próximos ni la sección
"Ya pasaron"—, con cuatro filas publicadas en la base. Es anterior a la
iteración de los campos, no lo causó.

La explicación conocida está en el plan de eventos: las páginas se prerenderizan
en el build, el build de Railway **no tiene acceso a la red privada**, la
consulta falla, `lib/eventos.ts` la atrapa y hornea una agenda vacía hasta que
vence el `revalidate: 900`. Medido el 2026-08-25: quince minutos justos.

**Lo que no cierra**: el deploy anterior fue el 2026-08-28, cuatro días antes, y
la agenda seguía vacía igual. O el `revalidate` no está regenerando, o la
consulta falla también en runtime. Antes de tocar nada hay que mirar los logs
del servidor buscando `[eventos] no se pudo leer la agenda`, que es lo que
imprime el `catch`.

## Worktrees viejos sin borrar

`git worktree list` muestra seis árboles y casi todos son de ramas ya mergeadas:
`Gorros-admin-catalogo`, `Gorros-bodega-home`, `Gorros-carrusel-bodegas`,
`Gorros-clientes` y `Gorros-eventos`. Se limpian con
`./scripts/worktree.ps1 borrar <slug> -borrarRama`.
