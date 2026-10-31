# Presupuestos, recibos, precio sin IVA y concepto "Productos y Servicios" — Plan

> **Para quien lo ejecute**: este plan es autocontenido. Todo el contexto
> necesario está acá; no hace falta releer la conversación donde se decidió.
> Antes de tocar código, leer `AGENTS.md` y `tasks/lessons.md`.
> Los pasos van con checkbox (`- [ ]`) y se marcan a medida que avanzan.

**Objetivo:** tres cosas en el facturador:

1. emitir **presupuestos y recibos** sin validez fiscal, con fecha libre, imprimibles, y pasarlos a factura con un clic;
2. cargar cada renglón con **precio sin IVA o con IVA**, y que el otro se complete solo;
3. facturar como **"Productos y Servicios"** (concepto 3 de ARCA), que admite fechar hasta 10 días atrás en vez de 5.

**Enfoque:**

- Los documentos no fiscales viven en tablas propias (`documentos`, `documento_items`) y no en `comprobantes`. `comprobantes` es fiscal de punta a punta: letra, `external_id`, estado de Facturante, correlatividad.
- Los renglones salen del formulario de la factura manual. Se separan en un componente compartido y reusan `calcular()`.
- El precio sin IVA es sólo de pantalla: el cálculo sigue en precio con IVA, así que no cambian ni el schema ni el request.
- El concepto se decide en `mapFactura` y en `rangoDeFecha`.

**Worktree:** rama `claude/loving-cori-4f45nc` (sesión en la nube, sin worktree: es la rama asignada).

---

## Contexto

El 2026-10-31 el usuario pidió:

- **"Otro tipo de comprobante, sin validez fiscal, similar a una factura. Puede ser tipo presupuesto o recibo."** Eligió los dos.
- **"Agregar precios sin IVA, y que el precio se autocomplete en base a eso."** Eligió dos columnas enlazadas.
- **"Elegir la fecha de la factura: muchas veces dejo para fin de mes la emisión y las hago todas juntas."**
  - La fecha elegible ya existe desde #19, con tope de 5 días (concepto 1, Productos).
  - El usuario decidió pasar a **concepto 3, Productos y Servicios**, para tener más margen.

### Lo que el concepto 3 cambia, y lo que no

- **ARCA (WSFEv1, `CbteFch`)**: para concepto 2 o 3 acepta de N-10 a N+10, contra N-5 / N+5 de Bienes.
- **Además pide** `FchServDesde`, `FchServHasta` y `FchVtoPago`:
  - Desde y Hasta son el período del servicio;
  - el vencimiento del pago no puede ser anterior a la fecha del comprobante.
- **La correlatividad no cambia**: ninguna factura puede tener fecha anterior a la última de la misma letra en el punto de venta. A fin de mes:
  - se puede fechar **hasta 10 días atrás**, no el mes entero;
  - las facturas se emiten **en orden cronológico**.

  Para cubrir un mes entero hace falta emitir al menos cada 10 días: por ejemplo los días 10, 20 y fin de mes.
- **Que la venta de vinos se facture como servicio es una decisión fiscal.** Gorros también hace eventos y catas, que sí son servicios, pero conviene que el contador lo confirme antes de la primera emisión real.
- **Facturante**: el campo es `header.detail.good` (hoy `GOOD_BIENES = 1`). Lo que no está verificado:
  - los `dateType` del período y del vencimiento: se presume 2 / 3 / 4, pero **no está verificado**;
  - la documentación (`apidoctest.facturante.com`) no es accesible desde la sesión en la nube.

  Se calibra en el sandbox, como se hizo con los tributos (Tarea 4).

## Mapa del código actual

| Qué | Dónde |
| --- | --- |
| Formulario de factura manual (renglones, fecha, vista previa) | `app/(admin)/admin/(panel)/facturacion/manual/factura-manual-form.tsx` |
| Página del formulario, carga productos/clientes/últimas fechas | `facturacion/manual/page.tsx` |
| Actions de facturación | `facturacion/actions.ts` |
| Receptor compartido | `facturacion/receptor-campos.tsx` |
| Cálculo puro, `parseImporte` | `lib/facturacion/calculo.ts` |
| Rango de fecha (`DIAS_HACIA_ATRAS = 5`) | `lib/facturacion/reglas.ts` |
| Reserva de factura / NC | `lib/facturacion/emitir.ts` |
| Request a Facturante (`GOOD_BIENES`, `dates`) | `lib/facturante/mappers.ts`, `types.ts` |
| Schema | `lib/db/schema.ts` (`comprobantes`, `comprobanteItems`, `formaPago`) |
| Chequeos offline | `scripts/prueba-facturacion.ts` |

## Decisiones ya tomadas (NO volver a preguntar)

1. **Dos tipos no fiscales: `presupuesto` y `recibo`**, en un solo formulario con un selector. Usan los mismos renglones que la factura manual: catálogo o libre, cantidad, precio, descuento.
   - **No llevan** percepción ni letra.
   - **El recibo lleva** forma de pago.
   - **El presupuesto lleva** "válido hasta" (opcional).
2. **Tablas propias**:
   - `documentos`: `id`, `tipo` (enum), `numero` (correlativo **por tipo**, único `(tipo, numero)`), `fecha` (libre), `cliente_id` nullable, `receptor_nombre`, `receptor_documento` (ambos opcionales), `forma_pago` nullable, `valido_hasta` nullable, `observaciones`, `total_centavos`, `anulado` (bool), `factura_id` (FK a `comprobantes`, cuando se facturó), `creado_por`, timestamps.
   - `documento_items`: mismas columnas que `comprobante_items`, sin `alcanzado`.
   - Migración `0014`, aditiva.
3. **Numeración**: `max(numero)+1` por tipo dentro de la transacción. Si choca el único (dos al mismo tiempo), se reintenta una vez. Se imprime "Presupuesto N° 0001" y "Recibo N° 0001".
4. **Fecha libre**: no hay correlatividad fiscal. Sólo se valida que sea una fecha real y no más de un año en el futuro.
5. **Doble clic**: igual que la factura manual, un uuid generado al renderizar es el id. Un segundo envío choca con la PK.
6. **Vista imprimible** en `/admin/facturacion/documentos/[id]`:
   - CSS de impresión y botón "Imprimir / Guardar PDF" (`window.print()`). No se genera un PDF en el servidor.
   - Leyenda fija **"DOCUMENTO NO VÁLIDO COMO FACTURA"**.
   - Datos de Gorros, receptor, renglones, total.
7. **No se edita ni se borra**: se anula (marca `anulado`), como la factura.
8. **Pasar a factura**:
   - Un botón en el documento abre `/admin/facturacion/manual?desde=<id>`, con renglones y cliente precargados.
   - Al emitir, la action guarda `documentos.factura_id`.
   - La fecha de la factura sigue las reglas fiscales: hasta 10 días atrás con concepto 3.
   - Un documento ya facturado no muestra el botón.
9. **Listado**: `/admin/facturacion/documentos` con filtro por tipo. Botones "Nuevo presupuesto / recibo" en Facturación.
10. **Precio sin IVA**:
    - Cada renglón tiene dos inputs enlazados, "Precio s/IVA" y "Precio c/IVA". El que se tipea manda y el otro se recalcula (×1,21 o ÷1,21, redondeado al centavo).
    - El cálculo y el request siguen usando el precio c/IVA. Precio de catálogo → completa los dos.
    - Vale para factura, presupuesto y recibo.
11. **Concepto 3 para todas las facturas nuevas** (manuales y de MP), con una constante en `mappers.ts`. Las NC copian el `detail` de su factura, así que heredan concepto y período.
    - **Período del servicio**: del día 1 del mes de la fecha de la factura hasta la fecha de la factura.
    - **Vencimiento del pago**: la fecha de la factura.
    - En la NC, el período es el de la factura original y el vencimiento, la fecha de la NC.
12. **`DIAS_HACIA_ATRAS` pasa a 10**, y el texto de ayuda lo dice. Las facturas de MP ya están cobradas y siguen con fecha de hoy.

## Fuera de alcance

- Mandar el presupuesto o el recibo por mail desde el sistema. Se imprime o se guarda como PDF y se comparte a mano.
- Convertir varios documentos en una sola factura.
- Que un recibo impacte en la cuenta corriente del cliente.
- Otras alícuotas de IVA.

---

## Tarea 1: Precio sin IVA (sólo pantalla)

- [x] `calculo.ts`:
  - `conIvaDeNeto(neto)` y `netoDeConIva(conIva)`, en centavos;
  - casos en `prueba-facturacion.ts` (1.000,00 ↔ 1.210,00; 999,99 ↔ 1.209,99).
- [x] Extraer los renglones de `factura-manual-form.tsx` a `facturacion/renglones.tsx`:
  - estado, fila, datalist de productos;
  - la casilla "Bebida (percepción)" es opcional.
- [x] Sumar el input "Precio s/IVA" enlazado.
- [x] **Verificar**: tsc, prueba offline, y el formulario en el navegador: tipear en cualquiera de las dos columnas.

## Tarea 2: Presupuestos y recibos

- [x] Schema: enum `documento_tipo`, tablas `documentos` y `documento_items`; `npm run db:generate` → `0014`. Revisar que sea sólo CREATE.
- [x] `lib/facturacion/documentos.ts`:
  - `reservarDocumento` (valida, calcula, numera e inserta en una transacción);
  - `anularDocumento`.
- [x] Actions: `emitirDocumentoAction` y `anularDocumentoAction` (zod, `requireUser`, `revalidatePath`, `redirect`).
- [x] Pantallas:
  - `documentos/nuevo` (formulario con selector de tipo, reusa `renglones.tsx` y un receptor simple: cliente del buscador o nombre/documento libre);
  - `documentos/[id]` (vista imprimible);
  - `documentos/page.tsx` (listado);
  - links en `facturacion/page.tsx`.
- [x] Mobile a 390 px y la impresión, sin el panel alrededor.

## Tarea 3: Pasar a factura

- [ ] `manual/page.tsx` lee `?desde=` y precarga renglones y cliente.
- [ ] La action de la factura recibe `documentoId` y lo enlaza en la misma transacción de la reserva.
- [ ] El documento muestra "Facturado: FB 00015-…" con link.

## Tarea 4: Concepto 3 — Productos y Servicios

- [ ] `types.ts`: `DocDetail.good` documentado, fechas del período.
- [ ] `mapFactura`: `good: 3` y las fechas del período y del vencimiento.
- [ ] `DIAS_HACIA_ATRAS = 10` en `reglas.ts`, con la fuente en el comentario.
- [ ] Casos en `prueba-facturacion.ts`: período del mes y NC que hereda.
- [ ] **Calibración en el sandbox** (`scripts/_facturante-sandbox.ts`, lo corre el usuario con las credenciales de test en su `.env.local`):
  - confirmar los `dateType` del período y del vencimiento;
  - una B y una A con fecha de 8 días atrás;
  - una NC.

  **No se mergea sin esto.**
- [ ] **Confirmar con el contador** que la venta de vinos puede ir como concepto 3.

## Cierre

- [ ] `npx tsc --noEmit`, `npm run prueba:facturacion`, `npm run build` (con el dev bajado)
- [ ] Probado en el navegador contra una base local
- [ ] `docs/ARQUITECTURA.md`: documentos no fiscales y concepto 3
- [ ] PR (cuando el usuario lo pida)

## Review

_(al cerrar)_
