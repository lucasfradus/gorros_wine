# Facturador con conceptos y forma de factura — Plan

> **Para quien lo ejecute**: este plan es autocontenido. Todo el contexto
> necesario está acá; no hace falta releer la conversación donde se decidió.
> Antes de tocar código, leer `AGENTS.md` y `tasks/lessons.md`.
> Los pasos van con checkbox (`- [ ]`) y se marcan a medida que avanzan.

**Objetivo:** facturar un cobro de MP con varios conceptos, en una pantalla a todo
el ancho que se lee como una factura. La factura manual usa la misma pantalla.

**Enfoque:** un componente `HojaFactura` dibuja la hoja y lo usan los dos
formularios. La factura de cobro pasa a recibir renglones, y el servidor exige que
el total coincida con el cobro. No cambia el schema.

**Worktree:** `../Gorros-facturador` · rama `feat/facturador` · puerto `:3009`

---

## Contexto

La factura de un cobro de MP tiene un renglón fijo por el total: sólo se carga el
receptor. Hay ventas que necesitan más de un concepto, y la única salida hoy es la
factura manual, que no queda asociada al cobro: el cobro sigue como pendiente y se
podría facturar dos veces.

Además, las dos pantallas son formularios apilados en una columna de 1080 px, y
recién la vista previa del final muestra algo parecido al comprobante.

## Mapa del código actual

| Qué | Dónde |
| --- | --- |
| Pantalla del cobro | [facturacion/[id]/page.tsx](../../app/(admin)/admin/(panel)/facturacion/[id]/page.tsx) |
| Formulario del cobro | [emitir-form.tsx](../../app/(admin)/admin/(panel)/facturacion/emitir-form.tsx) |
| Pantalla manual | [manual/page.tsx](../../app/(admin)/admin/(panel)/facturacion/manual/page.tsx) |
| Formulario manual | [factura-manual-form.tsx](../../app/(admin)/admin/(panel)/facturacion/manual/factura-manual-form.tsx) |
| Renglones, también usados por presupuestos | [renglones.tsx](../../app/(admin)/admin/(panel)/facturacion/renglones.tsx) |
| Receptor | [receptor-campos.tsx](../../app/(admin)/admin/(panel)/facturacion/receptor-campos.tsx) |
| Confirmación antes de emitir | [vista-previa.tsx](../../app/(admin)/admin/(panel)/facturacion/vista-previa.tsx) |
| Actions y lectura de renglones | [actions.ts](../../app/(admin)/admin/(panel)/facturacion/actions.ts), [renglones-schema.ts](../../app/(admin)/admin/(panel)/facturacion/renglones-schema.ts) |
| Reserva de la factura | [lib/facturacion/emitir.ts](../../lib/facturacion/emitir.ts) |
| Cuentas | [lib/facturacion/calculo.ts](../../lib/facturacion/calculo.ts) |
| Ancho completo | `.anchoCompleto` en [admin.module.css](../../app/(admin)/admin/admin.module.css) |

## Decisiones ya tomadas (NO volver a preguntar)

1. **Total exacto**: el total de la factura, percepción incluida, tiene que ser
   igual al importe del cobro. Se bloquea en pantalla y en el servidor.
2. **Una factura por cobro**: es lo que ya garantiza el índice de `comprobantes`.
3. **El cobro arranca como hoy**: con un renglón por el total y
   `descripcionDelCobro`, editable. Emitir sin tocar nada da la misma factura de
   hoy.
4. **Fecha y forma de pago del cobro no cambian**: fecha del día y pago
   electrónico. La venta sigue siendo el día del cobro.
5. **Misma hoja para las dos facturas**: el cobro y la manual comparten
   `HojaFactura`.
6. **La barra lateral del panel se mantiene**: "toda la pantalla" es todo el ancho
   de contenido, con `.anchoCompleto`.
7. **La hoja sigue el tema del panel**: usa tokens de `app/globals.css`, sin
   colores fijos ni papel blanco forzado.
8. **La confirmación se mantiene**: emitir es irreversible, así que el diálogo de
   `VistaPrevia` sigue antes del envío.
9. **Los datos del emisor son los que ya hay**: marca y `EMISOR_CUIT`. El
   comprobante legal sigue siendo el PDF de Facturante; la hoja es para cargar.

## Fuera de alcance

- Repartir un cobro entre varias facturas o una factura entre varios cobros.
- Elegir fecha o forma de pago en la factura de un cobro.
- Cambiar el PDF de Facturante.
- Rediseñar el detalle de un comprobante ya emitido.
- Sumar a la hoja los datos fiscales del emisor que hoy no están en el sistema.

---

## Archivos

- **Crear** `app/(admin)/admin/(panel)/facturacion/hoja-factura.tsx` — el marco:
  encabezado con emisor, recuadro de la letra, número y fecha, y totales abajo a la
  derecha.
- **Crear** `app/(admin)/admin/(panel)/facturacion/hoja-factura.module.css` — estilos
  de la hoja, con tokens.
- **Modificar** `emitir-form.tsx` — usa `useRenglones`, `RenglonesCampos` y la
  diferencia contra el cobro.
- **Modificar** `factura-manual-form.tsx` — pasa a la hoja, sin cambiar reglas.
- **Modificar** `renglones.tsx` y `facturacion.module.css` — renglones como tabla
  en escritorio y tarjetas en celular.
- **Modificar** `[id]/page.tsx` — ancho completo, productos del catálogo y datos del
  cobro en una columna lateral.
- **Modificar** `manual/page.tsx` — ancho completo.
- **Modificar** `actions.ts` — `emitirFacturaAction` lee renglones y percepción.
- **Modificar** `lib/facturacion/emitir.ts` — `reservarFactura` recibe renglones, y
  `reservar` valida un total exigido.
- **Modificar** `scripts/prueba-facturacion.ts` — casos del total exigido.
- **Modificar** `docs/ARQUITECTURA.md` — la factura de cobro ya no es de un renglón.

---

## Tareas

### Tarea 1: el servidor acepta conceptos

- [x] **Paso 1**: en `reservar`, sumar `totalExigidoCentavos?: number`. Después de
      `calcular`, si no coincide, devolver un error que diga ambos importes.
- [x] **Paso 2**: `reservarFactura` recibe `renglones` y `percepcionIva`, y exige
      `mov.montoCentavos`. Actualizar su comentario.
- [x] **Paso 3**: `emitirFacturaAction` usa `leerRenglones` y la casilla
      `percepcionIva`, igual que la manual.
- [x] **Paso 4**: casos en `scripts/prueba-facturacion.ts`: coincide, falta, sobra y
      coincide sólo con la percepción.

### Tarea 2: el formulario del cobro

- [x] **Paso 1**: `EmitirForm` arranca `useRenglones` con el renglón del cobro y
      recibe `productos`. `productoId` queda en `null` y `alcanzado` en `false`.
- [x] **Paso 2**: percepción con la misma regla que la manual: sólo responsable
      inscripto, y precargada desde el cliente.
- [x] **Paso 3**: mostrar "Cobro", "Facturado" y "Falta" o "Sobra". Deshabilitar
      "Revisar y emitir" hasta que la diferencia sea cero.
- [x] **Paso 4**: `[id]/page.tsx` carga `productosParaFacturar()` sólo si el cobro
      es facturable.

### Tarea 3: la hoja

- [x] **Paso 1**: crear `HojaFactura`, con la letra que cambia según el receptor y
      "Se numera al emitir" en lugar del número.
- [x] **Paso 2**: pasar los renglones a columnas Detalle, Cant., Precio s/IVA,
      Precio c/IVA, Dto. % y Subtotal, sin repetir etiquetas por fila.
- [x] **Paso 3**: ordenar el receptor en dos columnas dentro de la hoja.
- [x] **Paso 4**: mover los dos formularios a la hoja. Los totales van abajo a la
      derecha y reemplazan a `.resumen` fuera del diálogo.
- [x] **Paso 5**: en el cobro, datos de MP en una columna lateral desde 1600 px; los comprobantes previos quedan arriba a todo el ancho, porque su tabla no entra en una columna

### Tarea 4: verificación

- [x] **Paso 1**: `npx tsc --noEmit`, `scripts/prueba-facturacion.ts` y
      `npm run build`, con el dev apagado.
- [x] **Paso 2**: en el navegador, cobro de prueba en la base local: agregar,
      quitar y buscar en catálogo; ver falta, sobra y exacto; Factura A y B.
- [x] **Paso 3**: revisar en 1440 px, 1024 px y celular, tema claro y oscuro.
- [x] **Paso 4**: confirmar que la factura manual y el formulario de presupuestos
      siguen funcionando, comparados contra `main`.
- [x] **Paso 5**: forzar por request un total distinto y confirmar el rechazo.
- [ ] **Paso 6**: después del deploy, y con el OK del usuario, una B real con dos
      conceptos más su NC. Facturante no tiene sandbox disponible.
- [ ] **Paso 7**: actualizar `docs/ARQUITECTURA.md`, sumar la Review y archivar.
