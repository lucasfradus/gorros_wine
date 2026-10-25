# Plan actual

> Este archivo tiene **el** plan en curso, no la lista de todo lo que existe.
> Al cerrar una iteración, su plan se archiva en `docs/planes/` y esto se vacía
> — **menos las secciones de pendientes de abajo, que se arrastran**.
>
> Antes de tocar código: leer `AGENTS.md` (este Next.js y este Drizzle no son
> los del training data) y `tasks/lessons.md`.

**Facturación centrada en comprobantes, y clientes en la factura.**
Plan completo: [docs/planes/2026-10-25-facturacion-clientes.md](../docs/planes/2026-10-25-facturacion-clientes.md).

Worktree `../Gorros-factura-manual` (reusado) · rama `feat/facturacion-clientes` · puerto `:3003`

- [x] **Tarea 1** — Schema: `clientes.localidad` y `clientes.provincia`, alta/edición de Clientes · migración `0011_curly_spiral` aplicada en local
- [x] **Tarea 2** — `resolverCliente` (asociar / completar vacíos / crear) dentro de la reserva · 7 chequeos offline nuevos
- [x] **Tarea 3** — Buscador de clientes y "Guardar como cliente" en el receptor · el receptor pasó arriba de los renglones
- [x] **Tarea 4** — `/admin/facturacion` = comprobantes; cobros de MP a `/cobros`; "Nueva factura"
- [x] **Tarea 5** — Comprobantes en la ficha del cliente
- [x] **Tarea 6** — `docs/ARQUITECTURA.md`
- [ ] **Cierre** — tsc ✓, prueba offline ✓, build ✓, sandbox ✓ (FA 00002-4 crea el cliente, FA 00002-5 lo asocia sin duplicar), review ✓ (arreglado), PR abierto · falta: merge y deploy (migración `0011`), probar en producción

## Viene de las iteraciones anteriores (sigue pendiente)

- **Factura manual (#18, mergeado y deployado)**: primera B manual real emitida
  bien en producción; umbral de la RG 5329 confirmado en $3.000. Falta, si no
  se hizo, probar la NC real sobre esa B. El worktree `../Gorros-factura-manual`
  se reusa para esta iteración.

- **Panel formal (#17, mergeado)**: Review y archivo de
  `docs/planes/2026-10-23-panel-formal.md`, y borrar el worktree
  `../Gorros-panel-formal`.

- **Facturación de MP (#16), pasos contra cuentas reales**: vincular la cuenta
  de MP en producción (registrar la redirect URI
  `https://gorros-wine-production.up.railway.app/api/mercadopago/callback`),
  correr el sync y compararlo con el panel de MP, primera B + NC y primera A
  con centavos + NC A sobre cobros reales, crear el servicio de cron en Railway
  (`node scripts/cron-diario.mjs`, `0 9 * * *`, confirmar antes), probar que un
  `editor` no ve Facturación, Review y archivo de
  `docs/planes/2026-10-23-facturacion-mp.md`, y borrar el worktree
  `../Gorros-facturacion-mp`.

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
  La facturación suma un tercer lugar que muestra plata: usar `formatARS`.
- **De `sin-ventas`**:
  - La columna del footer se sigue llamando **"Tienda"** y lista sólo Club y
    Eventos. Es `footer.tiendaTitulo` en el CMS.
  - El inicio del panel sigue contando los vinos de muestra de `lib/data.ts`.
  - En producción, el texto de los botones del hero y del cierre de Nosotros
    puede estar editado desde el panel: el `original` nuevo no pisa lo guardado.
    Mirarlo después del deploy.

## Sin resolver: la agenda de producción sale vacía

`/eventos` en producción no muestra **ningún** evento. Medido el 2026-09-02:
la página se regenera en runtime (`x-nextjs-cache: HIT` fresco), el `catch` no
loguea error, y aun así renderiza cero filas — la consulta anda y **devuelve
cero eventos publicados**. Es el dato, no el caché ni el código.

**El paso que sigue**: abrir `/admin/eventos` en producción y ver si las cuatro
filas están y con qué `publicado`. Hace falta sesión en el panel; la base de
producción no se consulta desde acá.
