# Facturas manuales de productos — Plan

> **Para quien lo ejecute**: este plan es autocontenido. Todo el contexto
> necesario está acá; no hace falta releer la conversación donde se decidió.
> Antes de tocar código, leer `AGENTS.md` y `tasks/lessons.md`.
> Los pasos van con checkbox (`- [ ]`) y se marcan a medida que avanzan.

**Objetivo:** emitir desde el panel una Factura A o B por una venta que no pasó
por Mercado Pago (local, mayorista, transferencia), armada con los productos del
catálogo —cantidad, precio, descuento— y con las percepciones que correspondan,
y anularla con su nota de crédito. Queda en Comprobantes junto a las de MP.

**Enfoque:** el pipeline de emisión de #16 (reserva → `after()` → Facturante →
webhook / consulta) no cambia. Lo nuevo es el *contenido* del comprobante: hoy
`mapFactura` arma un único renglón con el importe de un cobro; se suma un módulo
puro de cálculo que convierte renglones + percepciones en los `items` y
`tributes` de Facturante y en los totales que se muestran. La factura manual es
un comprobante sin `movimiento_id`. Sus renglones se guardan en una tabla propia
(qué producto, cuántos, a cuánto) para poder consultarlos después.

**Worktree:** `../Gorros-factura-manual` · rama `feat/factura-manual` · puerto `:3003`

---

## Contexto

La facturación de #16 (plan `2026-10-23-facturacion-mp.md`) sólo factura cobros
de MP, con un renglón genérico. Gorros vende productos: una venta de mostrador o
mayorista tiene varias líneas (6 Malbec Reserva, 2 magnum, una caja de copas),
descuentos por línea, y a veces lleva percepciones de IIBB o de IVA. Hoy eso
sólo se puede facturar desde el panel de Facturante.

Clicnet (`C:\Users\lucas\Clic\Clicnet`, `src/lib/modules/facturacion/factura-manual.ts`)
es la base del *pipeline* —reserva sin pago, mapper con datos planos, `after()`—
pero su pantalla está pensada para servicios: un concepto y un monto. Acá se
hace una pantalla de venta de productos.

## Lo que dice Facturante (verificado en su documentación)

Fuente: `https://apidoctest.facturante.com` (es una SPA; el contenido está en
`main.js`, y los ejemplos en `/assets/examples/invoiceA|invoiceB/*.json`; el de
tributos es `invoiceB/029-WithTributes.json`).

- **Percepciones van en `header.tributes`**, un array:
  - `tributeId` (obligatorio):
    - 2 Percepción Nacional IVA, 3 Ganancias.
    - IIBB por jurisdicción: 4 AGIP (CABA), 5 ARBA (Bs. As.), 7 Catamarca, 8 Córdoba, 9 Corrientes, 10 Tucumán, 11 Jujuy, 12 Salta, 13 Chaco, 14 Misiones, 15 Formosa, 16 Entre Ríos, 17 Santa Fe, 18 Santiago del Estero, 19 San Juan, 20 Mendoza, 21 Neuquén, 22 La Pampa, 23 Río Negro, 24 Santa Cruz, 25 Tierra del Fuego, 26 San Luis, 27 La Rioja, 28 Chubut.
    - 29 Impuestos internos, 6 Otro.
  - `amount` (obligatorio).
  - `amountAffected` (obligatorio): la base imponible.
  - `amountType`: 1 = monto, 2 = porcentaje. **Si no se manda, es 2 (porcentaje)**, así que se manda siempre explícito.
  - `comment` (opcional).
- **Descuentos y recargos** van en `modifications`, por ítem o por documento:
  - Campos: `reason`, `amount`, `amountType` (1 monto / 2 %) y `type` (1 descuento / 2 recargo).
  - Primero se aplican los porcentajes y después los montos.
- **Ítems**: además de lo que ya usamos, aceptan `code` (`codeType`, `code`, `softwareId`) para un código propio o EAN, y `measureUnit`.
- **Cálculo automático**: existe `POST /APIClient/Tribute/Calculate`, que calcula las percepciones con los padrones de ARBA y AGIP. Recibe:
  - las provincias donde el emisor es agente;
  - la inscripción del receptor;
  - los ítems.

  No sabemos si está incluido en el plan contratado, así que queda para la fase 2.
- La NC copia `items` del request de la factura (`mapNotaCredito`). Ahora tiene
  que copiar también `tributes`.

## Mapa del código actual

| Qué | Dónde |
| --- | --- |
| Tabla `comprobantes`, índices de factura y NC viva | [lib/db/schema.ts](../../lib/db/schema.ts) (`comprobantes`) |
| Productos (precio en centavos, `moneda` ARS/USD) y `cotizaciones` | [lib/db/schema.ts](../../lib/db/schema.ts) (`productos`, `cotizaciones`) |
| Reserva de factura (lee el cobro de MP) y de NC | [lib/facturacion/emitir.ts](../../lib/facturacion/emitir.ts) |
| Envío, guardado, reconciliación, webhook | `lib/facturacion/{enviar,guardar,reconciliar,webhook}.ts` — no se tocan |
| Request a Facturante (`mapFactura` de un renglón, `sellCondition` fijo en 6), tipos recortados | [lib/facturante/mappers.ts](../../lib/facturante/mappers.ts), [types.ts](../../lib/facturante/types.ts) |
| Validación del receptor y letra | [lib/facturacion/reglas.ts](../../lib/facturacion/reglas.ts) |
| Actions de emisión | [facturacion/actions.ts](../../app/(admin)/admin/(panel)/facturacion/actions.ts) |
| Formulario del receptor | [facturacion/emitir-form.tsx](../../app/(admin)/admin/(panel)/facturacion/emitir-form.tsx) |
| Página por cobro, con la tabla de comprobantes y sus acciones | [facturacion/[id]/page.tsx](../../app/(admin)/admin/(panel)/facturacion/[id]/page.tsx) |
| Listado de comprobantes (linkea al cobro) | [facturacion/comprobantes/page.tsx](../../app/(admin)/admin/(panel)/facturacion/comprobantes/page.tsx) |
| Chequeos offline | [scripts/prueba-facturacion.ts](../../scripts/prueba-facturacion.ts) (`npm run prueba:facturacion`) |
| Referencia del pipeline manual | Clicnet `src/lib/modules/facturacion/factura-manual.ts`, `src/lib/facturante/sell-condition.ts` |

## Decisiones ya tomadas (NO volver a preguntar)

1. **Factura manual = comprobante con `movimiento_id` NULL.** La NC copia el de
   su factura (NULL también).
2. **Renglones de producto.** Cada renglón:
   - es un producto del catálogo (buscador por nombre) o un texto libre;
   - tiene cantidad, precio unitario **con IVA incluido** (precargado del
     catálogo y editable) y descuento % opcional;
   - va con IVA 21% siempre, igual que hoy. Otras alícuotas, fuera de alcance.
   - Precio en USD del catálogo: se pesifica con la última `cotizaciones` al
     precargar, y lo que vale es el número que queda en el renglón.
3. **Los renglones se guardan en `comprobante_items`**:
   - Columnas: `comprobante_id`, `producto_id` nullable, `descripcion`,
     `cantidad`, `precio_unitario_centavos`, `descuento_pct`,
     `subtotal_centavos`, `orden`.
   - Es el dato de qué se vendió. El `request_payload` sigue siendo la verdad
     de lo que se mandó.
   - Las facturas de MP también escriben su único renglón, sin producto.
4. **El descuento va dentro del precio unitario y se nombra en la descripción**
   ("Malbec Reserva 750 (10% dto.)").
   - Cambió después de la calibración: con `modifications`, el PDF de la
     Factura B imprime la bonificación dividida por el precio unitario, así que
     6 botellas al 10% salen "-60,00 %". El subtotal está bien.
   - Pasa igual mandándolo como % que como monto. La A lo imprime bien.
   - Se usa el mismo modelo en A y B: el precio con descuento se redondea por
     unidad (`precioConDescuento`) y el subtotal es cantidad × ese precio, que
     es exactamente la cuenta que hace Facturante.
5. **La única percepción de v1 es la de IVA de la RG 5329/2023** (el usuario
   la citó como "RG 5239, el 3%"; es la 5329, modificada por la 5334). Va como
   `tributeId: 2` (Percepción Nacional IVA). Regla:
   - **A quién**: a un comprador Responsable Inscripto que revende sin
     transformar (almacén, vinoteca, restaurante). No se le aplica a un
     consumidor final ni a un RI que lo consume. Como eso no se deduce del
     CUIT, va en el cliente: `clientes.percepcion_iva` (boolean, "se le percibe
     IVA RG 5329"), visible en la ficha cuando es RI. En la factura se
     precarga de ahí y se puede destildar.
   - **Sobre qué**: alimentos, **bebidas**, higiene y limpieza; una copa o una
     heladera no entran. Cada renglón lleva "alcanzado" y la base es el neto
     de los renglones alcanzados. El default sale de `categorias.es_vino`; un
     renglón libre arranca alcanzado. Se puede cambiar por renglón.
   - **Cuánto**: 3% del neto alcanzado (1,5% para operaciones al 10,5%, que
     acá no hay porque todo va al 21%).
   - **Mínimo**: sólo si la percepción **supera $3.000** por operación (RG 5334).
     Por debajo no se aplica. El formulario muestra "no corresponde: menos de
     $3.000" y el servidor no la manda. El umbral y la alícuota son
     constantes con la fuente en un comentario, porque ARCA los actualiza.
     **Confirmar con el contador que el umbral siga en $3.000.**
   - Se guarda en `comprobantes.tributos` (jsonb
     `[{tipo, alicuota, baseCentavos, montoCentavos}]`), con la forma de una
     lista para que sumar IIBB más adelante no cambie el schema.
   - Se manda con `amountType: 1` (monto) y la base en `amountAffected`.
   - La NC la copia.
6. **`totalCentavos` incluye las percepciones.** El que se muestra antes de
   emitir es el estimado propio; al autorizar manda el `total` de Facturante,
   como ya hace `guardarDocumento`.
7. **Forma de pago** (pgEnum `forma_pago`: `efectivo`, `debito`, `credito`,
   `transferencia`, `electronico`) → `sellCondition` con los códigos de Clicnet:
   1, 2, 3, 5, 6. MP sigue en 6.
8. **La fecha es siempre hoy** (`hoyEnArgentina()`). Confirmado por el usuario.
9. **Doble clic sin duplicar**: el formulario trae un uuid generado al
   renderizar y ese uuid es el id del comprobante. Un segundo envío choca con
   la PK (23505) y no sale una segunda factura (Facturante no deduplica).
10. **El cálculo es una función pura** (`lib/facturacion/calculo.ts`, sin imports
    de `@/`) que usan el formulario (para mostrar), el servidor (para emitir) y
    el chequeo offline. Todo en centavos enteros; los decimales sólo al armar el
    request.
11. **Rutas**:
    - `/admin/facturacion/manual`: el formulario.
    - `/admin/facturacion/manual/[id]`: la factura, sus renglones, percepciones,
      NC y acciones. Al reservar, la action redirige acá.
    - La tabla de comprobantes con sus acciones sale a `tabla-comprobantes.tsx`,
      compartida con la página del cobro.
12. **Probar contra el sandbox antes que en producción.** Los ítems múltiples,
    `modifications` y `tributes` nunca se mandaron desde ningún sistema
    nuestro. Se calibran contra `apitest.facturante.com` antes de la primera
    emisión real (Tarea 2).
13. **Primera emisión real en Railway**, confirmada antes con el usuario: una B
    chica de dos renglones con descuento y su NC. Después, si corresponde, una A
    con percepción y su NC.

## Respuestas del usuario (2026-10-24)

- **Percepciones**: la de IVA RG 5329, 3%, "no aplica siempre, depende lo que se
  facture o a quien" → decisión 5.
- **Sandbox**: con la empresa de Testing de Clicnet. Es Responsable Inscripto
  (company 224234, subsidiary 8245, POS 9419) y está en
  `docs/facturacion-electronica/facturante-TESTING.postman_collection.json` de
  Clicnet. La contraseña **no** está en el repo: está cifrada en la base de
  Clicnet. La carga el usuario en el `.env.local` de este worktree, nunca en
  el chat ni en un commit.
- **`feat/panel-formal`**: mergeado como #17 antes de empezar.

## Fuera de alcance (fase 2)

- **NC parcial**: devolver algunos renglones o cantidades. La NC de v1 anula la
  factura entera, como hoy.
- **Cálculo automático de percepciones** con `Tribute/Calculate` (padrones ARBA /
  AGIP), si el plan de Facturante lo incluye.
- **Descontar stock** al facturar. Hoy no hay módulo de ventas, y la factura no
  debería ser quien mueva stock.
- **Cuenta corriente**: registrar la factura como deuda del cliente en
  `movimientos_cc`, o facturar desde la ficha del cliente.
- Otras alícuotas de IVA, impuestos internos, monotributo, fecha anterior a hoy,
  moneda extranjera en el comprobante.

---

## Archivos

- **Modificar** `lib/db/schema.ts`:
  - `movimiento_id` nullable;
  - en `comprobantes`, `forma_pago` (+ enum) y `tributos`;
  - tabla `comprobante_items`.
  - Migración `0010`.
- **Crear** `lib/facturacion/calculo.ts`:
  - entrada: renglones y percepciones;
  - salida: items y tributes de Facturante + neto, IVA, percepciones y total en centavos;
  - también `parseImporte` (formato argentino → centavos).
- **Crear** `lib/facturacion/percepciones.ts` — lista de `tributeId` con nombre
  (o dentro de `lib/facturante/`, junto a `provincias.ts`).
- **Modificar** `lib/facturante/types.ts`:
  - `DocItem.modifications`, `DocItem.code`, `DocHeader.tributes`;
  - `sellCondition` por forma de pago.
- **Modificar** `lib/facturante/mappers.ts`:
  - `mapFactura` recibe `items` y `tributes` ya calculados y la forma de pago;
  - `mapNotaCredito` copia `tributes`.
- **Modificar** `lib/facturacion/emitir.ts`:
  - reserva común;
  - `reservarFactura` (MP, un renglón) y `reservarFacturaManual` encima;
  - inserta `comprobante_items`.
- **Modificar** `app/.../facturacion/actions.ts`:
  - `receptorSchema` compartido y `emitirFacturaManualAction`;
  - renglones y percepciones llegan como JSON en un input oculto, validado con zod.
- **Crear** `app/.../facturacion/manual/factura-manual-form.tsx`:
  - renglones con buscador de producto, percepciones y forma de pago;
  - reusa el bloque de receptor de `emitir-form.tsx`, que se separa en su propio componente.
- **Crear** `app/.../facturacion/tabla-comprobantes.tsx`; **modificar**
  `[id]/page.tsx` para usarla.
- **Crear** `app/.../facturacion/manual/page.tsx` y `manual/[id]/page.tsx`.
- **Modificar** `facturacion/page.tsx` (botón "Factura manual") y
  `comprobantes/page.tsx` (link al cobro o al detalle manual; marca de percepción).
- **Crear** `scripts/_facturante-sandbox.ts`:
  - manda los casos de calibración a `apitest` y muestra el total que devuelve
    Facturante contra el propio;
  - dry-run por defecto, envía sólo con `APPLY=1`;
  - se niega si la URL no es la de test.
- **Modificar** `scripts/prueba-facturacion.ts`, `docs/ARQUITECTURA.md`.

---

## Tarea 0: Arrancar sobre el panel nuevo

`feat/panel-formal` está terminado y sin PR. Toca las mismas páginas
(`data-label` en las celdas, para mobile) y reescribe `admin.module.css`.

- [x] Mergeado como #17 (`da37b0a`); la rama arranca desde ahí.

## Tarea 1: Cálculo y mapper (offline)

- [x] `calculo.ts`. Por renglón:
  - bruto = cantidad × precio;
  - descuento = redondeo(bruto × %);
  - neto = redondeo(bruto con descuento / 1,21).

  Los totales salen de sumar los renglones. Cada percepción es
  redondeo(neto total × alícuota).
- [x] `parseImporte`:
  - acepta `12.345,67`, `12345,67`, `12345.67`, `12345` y `$ 12.345`;
  - rechaza vacío, cero o negativo, más de dos decimales, letras y más de $100.000.000.
- [x] Tipos y `mapFactura` con varios ítems, `modifications`, `tributes` y forma
      de pago. La factura de MP arma **el mismo request que hoy**: comparar
      `--ver` contra `main`.
- [x] `prueba-facturacion.ts` suma casos:
  - un renglón sin descuento coincide con el request actual;
  - tres renglones con descuento, con los totales a mano;
  - percepción RG 5329: 3% sobre el neto de los renglones alcanzados (vino sí,
    copas no);
  - con menos de $3.000 de percepción no se aplica, y con $3.000,01 sí;
  - la NC copia ítems y tributos;
  - efectivo da `conditionType` 1.
- [x] **Verificar**: `npm run prueba:facturacion` y `npx tsc --noEmit` en verde.

## Tarea 2: Calibración en el sandbox de Facturante

Requiere las respuestas de "Preguntas abiertas".

- [x] `scripts/_facturante-sandbox.ts` con credenciales de test sólo en el
      `.env.local` del worktree.
- [x] Casos:
  - B de un renglón;
  - B de 3 renglones con descuento %;
  - A con centavos y percepción IVA RG 5329 sobre una parte de los renglones;
  - NC de la A con percepción.
- [x] Para cada uno: el `total` de Facturante coincide con el nuestro al centavo,
      y el PDF muestra los renglones, el descuento y la percepción como se espera.
      Si no coincide, ajustar `calculo.ts`, o la decisión 4, hasta que coincida.
- [x] Anotar en este plan los hallazgos (abajo).

**Hallazgos de la calibración (2026-10-24, synctest, company 224234 RI, POS 9419):**

- **Corrida 1, con `modifications`**: FB 00002-37 y 38, FA 00002-1 y NCA 00002-1.
  Las cuatro autorizadas y el total de Facturante coincide al centavo con
  `calculo.ts` en todas.
- **Bonificación en la B**: imprime mal el %. Lo que se vio:
  - 6 × 10% sale "-60,00 %", con el subtotal bien.
  - Pasa igual mandando el descuento como monto (FB 40).
  - El monto de una `modification` es **por renglón**, no por unidad: $1.500
    con cantidad 6 dio $88.500 (FB 39).
  - Con el descuento dentro del precio (FB 41) sale bien. Esto decidió la
    decisión 4.
- **Corrida 2, con el descuento en el precio**: FB 00002-42 y 43, FA 00002-2 y
  NCA 00002-2. Todas coinciden.
  - **PDF de la B**: el precio con descuento y "(10% dto.)" en la descripción.
  - **PDF de la A**: "PERCEPCION NACIONAL IVA 3,00%: $ 5.157,94", con la
    condición de venta "Tarjeta de Débito".
  - **PDF de la NC A**: copia la percepción y lista la FA como documento asociado.
- **`tributes` con `amountType: 1`**: Facturante toma `amount` como importe
  final y `amountAffected` como base, y lo imprime como "IVA 3,00%". La
  alícuota la deduce sola.
- **Sin cambios respecto de #16**: la B a consumidor final anónimo imprime como
  "Dirección" del cliente la de la sucursal del emisor.
- **`.env.local` y Next**: la contraseña del sandbox tiene `$` y `#`. Next
  expande `$VAR` aun entre comillas simples, y sin comillas corta en el `#`.
  Va entre comillas dobles y con `\$`.

## Tarea 3: Schema y migración

- [x] `formaPago` pgEnum; `forma_pago` y `tributos` (jsonb) en `comprobantes`;
      `movimientoId` nullable; tabla `comprobante_items` con FK a comprobante
      (restrict) y a producto (set null).
- [x] `clientes.percepcion_iva` (boolean, default false) y su casilla en el
      formulario del cliente (visible si es RI) y en la ficha.
- [x] `npm run db:generate` → `0010_*.sql`. Revisar que sólo haya CREATE TYPE,
      CREATE TABLE, ADD COLUMN y DROP NOT NULL. `npm run db:migrate` local.
- [x] **Verificar**: tsc en verde (marca lo que asumía `movimientoId` string).

## Tarea 4: Reserva y action

- [x] `emitir.ts`:
  - una reserva común que valida el receptor, el cliente, los renglones (al
    menos uno, cantidad > 0, precio > 0, descuento 0–100) y las percepciones
    (alícuota > 0 y ≤ 20, sin repetir tipo);
  - calcula, arma el request, inserta comprobante + ítems en una transacción y
    maneja el 23505.
- [x] `reservarFactura` (MP) se queda con un renglón y su comportamiento actual.
      Se suma `reservarFacturaManual`. `reservarNotaCredito` copia ítems y tributos.
- [x] `emitirFacturaManualAction`: zod, reserva, `after(enviarComprobante)`,
      `revalidatePath`, `redirect` al detalle.
- [x] **Verificar**: tsc, prueba offline; la página de un cobro de MP factura
      igual que antes.

## Tarea 5: Pantallas

- [x] Separar el bloque de receptor de `emitir-form.tsx` (cliente, condición,
      documento, nombre, mail, domicilio) en un componente que usan los dos
      formularios.
- [x] `factura-manual-form.tsx`:
  - **renglones**:
    - buscador de producto (activos, con precio; USD pesificado con la última
      cotización y avisado);
    - texto libre;
    - cantidad, precio, descuento %; subtotal por línea; agregar y quitar;
  - **percepciones**: agregar tipo + alícuota, base y monto calculados a la vista;
  - **forma de pago**;
  - **resumen**: neto, IVA 21%, cada percepción, total.

  Mobile primero: los renglones son tarjetas apiladas a 390 px.
- [x] `manual/page.tsx` y `manual/[id]/page.tsx` (404 si el comprobante tiene
      cobro: ése se ve en su cobro). `AutoRefresh` mientras emite.
- [x] `tabla-comprobantes.tsx` extraída sin cambiar comportamiento.
- [x] Botón "Factura manual" en Facturación; links en Comprobantes.
- [x] **Verificar** en `:3003` con `FACTURANTE_BASE_URL` apuntando al sandbox:
  - una A con percepción y una B con descuento salen autorizadas en test;
  - la NC anula;
  - doble clic deja una sola fila;
  - errores de validación legibles;
  - 390 px y escritorio.

## Tarea 6: Docs

- [x] `docs/ARQUITECTURA.md`: facturas manuales, renglones, percepciones.
- [x] Review de este plan al cerrar.

---

## Migraciones

- [ ] `0010` es aditiva salvo el `DROP NOT NULL` de `movimiento_id`, que no
      rompe a nadie: el resto del código siempre inserta uno. Se aplica en
      Railway con el `preDeployCommand` existente.

## Cierre

- [x] `npx tsc --noEmit`
- [x] `npm run prueba:facturacion`
- [x] `npm run build` (con el dev bajado, ver lessons)
- [x] Probado contra el sandbox en `:3003`
- [ ] PR mergeado a `main` y deploy en Railway; restaurar `.env.local` a producción
- [ ] **Con confirmación del usuario**: primera B manual real de dos renglones +
      NC; si corresponde, una A con percepción + NC. Mirar logs y webhook.
- [ ] `./scripts/worktree.ps1 borrar factura-manual -borrarRama` (confirmar antes)

## Review

**Hecho** (2026-10-24): factura manual de varios renglones (catálogo o libres) con descuento, forma de pago y percepción de IVA RG 5329, su NC, detalle por factura y marcas en Comprobantes. La reserva es común con la de MP y el request de un cobro quedó idéntico a `main`.

**Cambió respecto del plan:**
- **Descuento**: va dentro del precio unitario y no como `modifications` (decisión 4, hallazgo del sandbox).
- **Percepción**: es sólo la RG 5329, con el flag `clientes.percepcion_iva` en vez de una lista genérica de percepciones por cliente.
- **Buscador de productos**: un `datalist` sobre la misma descripción, en vez de un componente aparte.

**Verificado:**
- `tsc`, `prueba:facturacion` y `build`.
- Sandbox: B, B con descuentos, A con percepción y su NC, todas al centavo.
- De punta a punta contra la base local y el sandbox, por funciones y por el formulario real (FB 00002-44), a 390 px y en escritorio.
- Review independiente: 0 críticos y 0 altos. Se arreglaron el medio (un renglón ilegible se descartaba en silencio) y tres de los bajos (precio final en $0, descuento con más de dos decimales, percepción heredada al volver a "Otro"). El cuarto (los renglones de una NC van en positivo) queda documentado en el schema.

**Pendiente:**
- Merge y deploy.
- Primera B manual real y su NC en producción, confirmada con el usuario.
- Confirmar con el contador el umbral de $3.000.
- Borrar el worktree.
- Fase 2 (fuera de alcance): NC parcial, cálculo automático de percepciones, stock, cuenta corriente.
- En la base local quedaron los comprobantes de prueba (FA/NCA 00002-3, FB 00002-44).
- El `.env.local` del worktree apunta al sandbox.
