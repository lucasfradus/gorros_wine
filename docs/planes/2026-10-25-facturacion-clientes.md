# Facturación centrada en comprobantes, y clientes en la factura — Plan

> **Para quien lo ejecute**: este plan es autocontenido. Todo el contexto
> necesario está acá; no hace falta releer la conversación donde se decidió.
> Antes de tocar código, leer `AGENTS.md` y `tasks/lessons.md`.
> Los pasos van con checkbox (`- [x]`) y se marcan a medida que avanzan.

**Objetivo:** que `/admin/facturacion` muestre lo facturado (todos los
comprobantes, manuales y de MP) en vez de los cobros de MP, y que al hacer una
factura se pueda elegir un cliente existente buscándolo, o guardar al receptor
como cliente nuevo.

**Enfoque:** la lista de comprobantes pasa a ser el inicio de Facturación y los
cobros de MP se mudan a `/admin/facturacion/cobros`. El receptor
(`receptor-campos.tsx`, compartido por la factura manual y la de un cobro) cambia
el `<select>` de clientes por un buscador y suma "Guardar como cliente". La
resolución del cliente (asociar, completar lo que le falta o crear) va en el
servidor, dentro de la misma transacción que reserva el comprobante.

**Worktree:** `../Gorros-factura-manual` (reusado) · rama `feat/facturacion-clientes` · puerto `:3003`

---

## Contexto

La factura manual (#18) ya emite en producción. Dos cosas quedaron cortas:

- **El inicio de Facturación es la lista de cobros de MP.** El negocio factura
  sobre todo a mano (mostrador, mayorista, transferencia); los comprobantes
  quedaron escondidos en un botón. Sin cuenta de MP vinculada, el inicio dice
  "todavía no hay una cuenta" y nada más.
- **El cliente se elige de un `<select>`** con todos los que tienen documento,
  sin búsqueda, y no hay forma de dar de alta al receptor desde la factura: a un
  cliente nuevo hay que cargarlo antes en Clientes y volver.

## Mapa del código actual

| Qué | Dónde |
| --- | --- |
| Inicio de Facturación (cobros de MP) | `app/(admin)/admin/(panel)/facturacion/page.tsx` |
| Lista de comprobantes | `app/(admin)/admin/(panel)/facturacion/comprobantes/page.tsx` |
| Detalle de un cobro (factura de MP) | `app/(admin)/admin/(panel)/facturacion/[id]/page.tsx` |
| Factura manual y su detalle | `app/(admin)/admin/(panel)/facturacion/manual/` |
| Bloque del receptor (compartido) | `app/(admin)/admin/(panel)/facturacion/receptor-campos.tsx` |
| Actions de facturación | `app/(admin)/admin/(panel)/facturacion/actions.ts` |
| Reserva del comprobante (transacción) | `lib/facturacion/emitir.ts` → `reservar()` |
| Validación del receptor | `lib/facturacion/reglas.ts` → `validarReceptor()` |
| Clientes: schema | `lib/db/schema.ts` → `clientes` |
| Clientes: alta/edición en el panel | `app/(admin)/admin/(panel)/clientes/actions.ts`, `cliente-forms.tsx` |
| Ficha del cliente | `app/(admin)/admin/(panel)/clientes/[id]/page.tsx` |
| Provincias (códigos de Facturante) | `lib/facturante/provincias.ts` |

Datos que importan de `clientes`: `documento` es texto libre (puede tener
guiones), `email` es UNIQUE (normalizado con `normalizeEmail`), hay `nombre`,
`apodo`, `razonSocial`, `condicionIva` (nullable), `percepcionIva`, `direccion`.
**No hay localidad ni provincia**, y la Factura A exige provincia: hoy a un RI
elegido de la lista hay que volver a cargarle la provincia cada vez.

## Decisiones ya tomadas (NO volver a preguntar)

1. **`/admin/facturacion` = comprobantes.** Todos, facturas y NC, manuales y de
   MP. Filtros: período, búsqueda (nombre del receptor, CUIT/DNI, número),
   tipo, letra, estado, origen (manual / MP). Totales del período. Cada fila
   lleva a su detalle. Botones: **Nueva factura** (primario), **Cobros de MP**,
   **Cuenta de MP**.
2. **Los cobros de MP pasan a `/admin/facturacion/cobros`**, con el mismo
   contenido de hoy. `/admin/facturacion/[id]` (detalle de un cobro) no cambia
   de URL; su "volver" va a Cobros. `/admin/facturacion/comprobantes` redirige
   a `/admin/facturacion` conservando la query.
3. **"Factura manual" se llama "Nueva factura"** en la UI. La URL `/manual` queda.
4. **Buscador de clientes** en vez del `<select>`: se tipea nombre, apodo, razón
   social o CUIT/DNI (con o sin guiones). Entran **todos** los activos, también
   los que no tienen documento (sale B sin identificar, pero queda asociada).
   La lista viaja entera al formulario: son cientos, no miles.
5. **"Guardar como cliente"**: casilla que aparece cuando no hay cliente
   elegido, **tildada por defecto** (decisión del usuario): destildarla es la excepción.
   Crea el cliente con lo cargado en el receptor.
6. **No duplicar**: si el CUIT/DNI tipeado ya es de un cliente, el formulario lo
   avisa ("Ya está como X — usar") y el servidor asocia a ese en vez de crear
   otro, aunque la casilla esté tildada. Se compara por dígitos.
7. **Completar, nunca pisar**: a un cliente asociado se le llenan los campos que
   tiene vacíos con lo que se usó en la factura (documento, razón social,
   condición IVA, mail, domicilio, localidad, provincia). Es lo que ya se hace
   hoy con `condicionIva`, extendido. Lo que ya tenía no se toca.
8. **Mail ocupado**: si el mail del receptor es de otro cliente, el cliente se
   crea (o se completa) sin mail. La factura sale igual con ese mail impreso.
9. **`clientes` suma `localidad` y `provincia`** (código de `PROVINCIAS`).
   Migración aditiva. El alta/edición de Clientes en el panel suma esos campos.
10. **Vale para las dos facturas** (manual y de un cobro), porque comparten el
    bloque del receptor.
11. **La ficha del cliente lista sus comprobantes** (últimos 20, con link al
    detalle). Es lo que hace útil asociarlos.

## Fuera de alcance

- Agrupar cada NC dentro de la fila de su factura (siguen siendo filas aparte).
- Editar el cliente desde la factura más allá de completar vacíos.
- Buscar clientes en el servidor (autocompletar con fetch): con la lista entera
  alcanza por ahora.
- Lo de fase 2 de la factura manual: NC parcial, percepciones automáticas,
  stock, cuenta corriente.

---

## Archivos

- **Crear** `lib/facturacion/cliente-receptor.ts` — `resolverCliente(tx, …)`:
  asocia, completa vacíos o crea, dentro de la transacción de la reserva.
  Aparte de `emitir.ts` porque es la única parte que escribe en `clientes`.
- **Crear** `app/(admin)/admin/(panel)/facturacion/cliente-buscador.tsx` — el
  combobox (input + lista filtrada, accesible con teclado).
- **Crear** `app/(admin)/admin/(panel)/facturacion/cobros/page.tsx` — la lista de
  cobros de MP, movida desde `facturacion/page.tsx`.
- **Modificar** `facturacion/page.tsx` — pasa a ser la lista de comprobantes.
- **Modificar** `facturacion/comprobantes/page.tsx` — redirect.
- **Modificar** `receptor-campos.tsx`, `actions.ts`, `lib/facturacion/emitir.ts`,
  `[id]/page.tsx`, `manual/page.tsx`, `manual/[id]/page.tsx` (textos y back links).
- **Modificar** `lib/db/schema.ts` + migración; `clientes/actions.ts`,
  `cliente-forms.tsx`, `clientes/[id]/page.tsx`.
- **Modificar** `scripts/prueba-facturacion.ts`, `docs/ARQUITECTURA.md`.

---

## Tarea 1: Schema

- [x] `clientes.localidad` (text) y `clientes.provincia` (text, código de
      `PROVINCIAS`), comentados con el porqué.
- [x] `npm run db:generate` y `npm run db:migrate` en local.
- [x] Alta/edición de Clientes: los dos campos nuevos (provincia como select);
      la ficha los muestra.
- [x] **Verificar**: tsc; crear y editar un cliente con provincia en `:3003`.

## Tarea 2: El cliente en el servidor

- [x] `resolverCliente(tx, { clienteId, guardar, receptor, percepcionIva })`
      → `clienteId | null`. Con id: completa vacíos. Sin id: busca por dígitos
      del documento; si existe, asocia y completa; si no y `guardar`, crea.
      Mail ocupado por otro → sin mail.
- [x] `reservar()` lo llama dentro de su transacción (reemplaza el update de
      `condicionIva` de después). El NC no lo usa: copia el cliente de la factura.
- [x] Actions: campo `guardarCliente`, `ciudad`/`provincia` ya llegan.
- [x] Chequeos offline: normalización del documento a dígitos.
- [x] **Verificar**: tsc; con el sandbox, una factura con "guardar" crea el
      cliente; otra con el mismo CUIT asocia al mismo sin duplicar; uno con
      provincia vacía la recibe.

## Tarea 3: El buscador y el receptor

- [x] `ClienteBuscador`: filtra por nombre, apodo, razón social y dígitos del
      documento; teclado (↑ ↓ Enter Esc); "Quitar" para volver a cargar a mano.
- [x] `ReceptorCampos`: usa el buscador; precarga localidad y provincia; casilla
      "Guardar como cliente" sin cliente elegido; aviso "Ya está como X — usar"
      cuando el documento coincide.
- [x] `manual/page.tsx` y `[id]/page.tsx`: cargan todos los clientes activos con
      los campos nuevos.
- [x] **Verificar**: tsc; en el navegador, a 390 px y a 1280 px, sin errores de
      hidratación.

## Tarea 4: Facturación arranca por los comprobantes

- [x] Mover la lista de cobros a `cobros/page.tsx` (links de filtros y de
      volver ajustados).
- [x] `facturacion/page.tsx`: lo de `comprobantes/page.tsx` más búsqueda,
      filtro de tipo y de origen, y los tres botones.
- [x] `comprobantes/page.tsx` → `redirect` con la query.
- [x] "Factura manual" → "Nueva factura" en botones y títulos.
- [x] **Verificar**: tsc; las tres URLs responden; los links de detalle llevan
      al lugar correcto (manual, cobro, NC → su factura).

## Tarea 5: Comprobantes en la ficha del cliente

- [x] `clientes/[id]/page.tsx`: últimos 20 comprobantes del cliente, sólo si
      el usuario puede facturar (`canFacturar`).
- [x] **Verificar**: la ficha del cliente de la prueba de la Tarea 2 los lista.

## Tarea 6: Documentación

- [x] `docs/ARQUITECTURA.md`: rutas de Facturación y la regla del cliente
      (asociar / completar / crear).

---

## Migraciones

- [x] `npm run db:generate` — el SQL queda en `drizzle/` y se commitea.
- [x] Es aditiva (dos columnas nullable).

## Cierre

- [x] `npx tsc --noEmit`
- [x] `npx tsx scripts/prueba-facturacion.ts`
- [x] `npm run build`
- [x] Probado a mano en `:3003` contra el sandbox de Facturante
- [ ] Review independiente
- [ ] PR mergeado a `main` (confirmar antes)
- [ ] `./scripts/worktree.ps1 borrar factura-manual -borrarRama` (confirmar antes)

## Review

**Hecho como se planeó**, con estos cambios:

- `resolverCliente` quedó en `emitir.ts` (necesita la transacción) y las
  reglas puras en `cliente-receptor.ts`, que es lo que prueba la revisión
  offline.
- **El receptor pasó arriba de los renglones** en la Nueva factura: con el
  buscador, el cliente precarga todo y es lo primero que se decide.
- Los totales del inicio salen de un `SUM` en SQL con los mismos filtros (no de
  las 300 filas que se muestran), y **una factura anulada cuenta en lo
  facturado**: su NC la descuenta. Antes el neto daba negativo.
- `ListaComprobantes` (sólo lectura) la comparten el inicio y la ficha del
  cliente; el detalle de una factura manual muestra a qué cliente quedó
  asociada.

**Probado en el sandbox** (`:3003`, base local): FA 00002-4 crea "Almacén
Prueba SRL" con domicilio, localidad y provincia; FA 00002-5, con el mismo CUIT
tipeado sin guiones y otra dirección, avisa "Ese documento ya es de…", asocia
sin duplicar y no pisa nada; FB 00002-45 crea un consumidor final con DNI; FB
00002-46 lo elige con el buscador (teclado) y le completa sólo el mail.

**Review independiente**: sin críticos. Arreglado: un choque del UNIQUE del
mail en `clientes` dentro de la transacción se leía "esa factura ya se mandó"
(ahora las escrituras de cliente van en un savepoint que reintenta sin mail);
"Cambiar" dejaba un RI sin CUIT (vuelve a consumidor final); totales sobre el
tope de filas; fechas imposibles en la URL; `%` y `_` en la búsqueda; foco y
anuncios del buscador.

**Pendiente, a propósito**:

- Dos facturas **simultáneas** al mismo CUIT nuevo pueden crear dos clientes
  (no hay único sobre `documento`, que es texto libre y tiene datos viejos).
  Con una sola persona facturando no pasa; si pasa, se arreglaría con un
  `pg_advisory_xact_lock` por documento en `resolverCliente`.
- Un CUIT/DNI que coincide asocia y completa vacíos **aunque** se destilde
  "Guardar como cliente": es la regla "no duplicar" acordada.

---

## Segunda vuelta (mismo PR #19)

Pedido: la pantalla de facturas a todo el ancho; un spinner mientras se emite
("Emitiendo…" se confundía con un estado final); confirmar o mostrar la factura
antes de emitir; elegir la fecha (con investigación de cuánto se puede ir para
atrás); "otros" en forma de pago (con investigación).

- [x] **Ancho**: `.main:has(.anchoCompleto)` sin `max-width`; lo usan el inicio
      de Facturación y Cobros de MP. Los formularios siguen angostos.
- [x] **Spinner** (`en-curso.tsx`): al lado del estado en las tablas, y un aviso
      arriba del detalle mientras se espera el CAE. Pasada la espera de
      `sePuedeMarcarNoEmitido`, deja de girar. "Por enviar" pasa a "Enviando…".
- [x] **Vista previa** (`vista-previa.tsx`): "Revisar y emitir" valida el
      formulario y abre un `<dialog>` con la factura armada; el submit real está
      adentro. Para la manual y la de un cobro.
- [x] **Fecha**: `comprobantes.fecha` (migración `0012`, completa las viejas con
      el día de `created_at` en Buenos Aires). Rango: hasta 5 días atrás (ARCA,
      WSFEv1 CbteFch, bienes) y nunca antes que la última de la letra; sin
      fechas futuras. Los listados filtran y ordenan por esta fecha.
- [x] **Formas de pago**: el maestro de Facturante (leído del sandbox) no tiene
      "otros", y sin condición el PDF imprime "Contado". Decisión del usuario:
      sumar las reales — depósito (4), cuenta corriente (11), cheque (12).
      Migración `0013`.
- [x] **Bug encontrado al probar fechas**: Facturante devuelve `UNAUTHORIZED`
      (final) cuando ARCA rechaza, con el motivo en
      `fiscalData.governmentMessage`. Se leía como "en proceso" y quedaba
      emitiéndose para siempre. Ahora es `rechazado` con ese motivo.

**Probado** en `:3003` contra el sandbox: FB 00002-47 sin condición de venta
(imprime "Contado"); una B fechada 3 días atrás con FB del día → `UNAUTHORIZED`
"Existe un comprobante con fecha posterior…"; FB 00002-48 con cheque desde la
vista previa → spinner y aviso en el detalle, autorizada, el PDF dice
"Condición de venta: Cheque". tsc, prueba offline (12 chequeos nuevos) y build.

**Pendiente**: confirmar con el contador si se puede fechar en el mes anterior
("no podrá exceder el mes de presentación").
