# Plan actual

> Este archivo tiene **el** plan en curso, no la lista de todo lo que existe.
> Al cerrar una iteración, su plan se archiva en `docs/planes/` y esto se vacía
> — **menos las secciones de pendientes de abajo, que se arrastran**.
>
> Antes de tocar código: leer `AGENTS.md` (este Next.js y este Drizzle no son
> los del training data) y `tasks/lessons.md`.

**Panel formal: paleta Grafito, Inter y mobile.**
Plan completo: [docs/planes/2026-10-23-panel-formal.md](../docs/planes/2026-10-23-panel-formal.md).

Worktree `../Gorros-panel-formal` · rama `feat/panel-formal` · puerto `:3002`

- [x] **Tarea 1** — Tokens semánticos Grafito, Inter, renombre en los CSS de sección
- [x] **Tarea 2** — Componentes compartidos (botón, campo, badge, tabla, tarjeta)
- [x] **Tarea 3** — Marco nuevo y menú lateral mobile
- [x] **Tarea 4** — Tablas como filas de lista y botonera fija en mobile
- [ ] **Cierre** — tsc ✓, build ✓, probado en 390px y escritorio, claro/oscuro ✓ · falta PR

---

**Facturación electrónica de los cobros de Mercado Pago** (mergeada en #16; quedan los pasos contra cuentas reales).
Plan completo: [docs/planes/2026-10-23-facturacion-mp.md](../docs/planes/2026-10-23-facturacion-mp.md).

Worktree `../Gorros-facturacion-mp` · rama `feat/facturacion-mp` · puerto `:3001`

- [x] **Tarea 0** — Credenciales de Facturante y de la app de MP, claves generadas
- [x] **Tarea 1** — Schema y migración `0009` (aditiva) · `0009_concerned_mongoose.sql`, aplicada
- [x] **Tarea 2** — `canFacturar`, `requireFacturacion`, ítem en el nav (falta probar con `editor`)
- [x] **Tarea 3** — OAuth de MP y pantalla de la cuenta · código listo; falta registrar la redirect URI y vincular la cuenta real
- [x] **Tarea 4** — `payments/search` y sync a `movimientos_mp` · código listo; falta correrlo contra la cuenta real y comparar con el panel de MP
- [x] **Tarea 5** — Cliente de Facturante, mappers A/B, validación de receptor · `npm run prueba:facturacion` (47 ok)
- [x] **Tarea 6** — Reservar, enviar, anular con NC, reconciliar, webhook · se prueba de verdad en Railway (decisión 23)
- [x] **Tarea 7** — Pantalla de movimientos y página por cobro con el formulario (decisión 25)
- [x] **Tarea 8** — Listado de comprobantes y condición IVA en clientes
- [ ] **Tarea 9** — Cron diario · route y script listos; **falta crear el servicio en Railway (confirmar antes)**
- [x] **Tarea 10** — `.env.example` y `docs/ARQUITECTURA.md`
- [ ] **Cierre** — tsc ✓, build, deploy a Railway (confirmar variables), primera B + NC, primera A con centavos + NC A, PR, borrar worktree

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
