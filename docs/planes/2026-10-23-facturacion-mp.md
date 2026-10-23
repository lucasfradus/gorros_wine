# Facturación electrónica de los cobros de Mercado Pago — Plan

> **Para quien lo ejecute**: este plan es autocontenido. Todo el contexto
> necesario está acá; no hace falta releer la conversación donde se decidió.
> Antes de tocar código, leer `AGENTS.md` y `tasks/lessons.md`.
> Los pasos van con checkbox (`- [ ]`) y se marcan a medida que avanzan.

**Objetivo:** una pantalla del panel que lista los cobros aprobados de la cuenta
de Mercado Pago del local y permite facturar cada uno —Factura B a consumidor
final o Factura A a un cliente con CUIT— y anularlo con nota de crédito.

**Enfoque:** se porta de Clicnet lo que ya está probado en producción: el OAuth
y el listado de pagos de MP, y el cliente de **Facturante.com** (el intermediario
que habla con ARCA y resuelve certificado, numeración, CAE, QR y PDF). Se
reescribe sobre Drizzle el acceso a datos y la pantalla. Tres tablas nuevas
(`cuentas_mp`, `movimientos_mp`, `comprobantes`) y una columna en `clientes`.

**Worktree:** `../Gorros-facturacion-mp` · rama `feat/facturacion-mp` · puerto `:3001`

---

## Contexto

Hoy el local cobra por Mercado Pago (QR, link, transferencias) y factura a mano
en otro sistema, copiando monto por monto. El cliente ya está dado de alta en
Facturante: se cargó una vez en Clicnet para probar, con su CUIT y su punto de
venta. Gorros es **Responsable Inscripto**, así que emite A y B (nunca C).

Gorros no tiene nada de pagos ni de facturación: ni tablas, ni SDKs, ni env.
La cuenta corriente de `clientes` (`movimientos_cc`) es manual y no se toca.

### De dónde se porta (Clicnet)

El repo es `C:\Users\lucas\Clic\Clicnet` (no `C:\Users\lucas\Clicnet`, que es el
vault de Obsidian). **Leer siempre de `origin/main`** con
`git -C C:\Users\lucas\Clic\Clicnet show origin/main:<ruta>` — el working tree
está en una rama vieja. Clicnet es Next 16 + **Prisma**: el TS puro se copia, el
acceso a datos se traduce a Drizzle.

| Pieza | Archivo en Clicnet (`origin/main`) | Cómo se trae |
| --- | --- | --- |
| Cifrado AES-256-GCM de tokens | `src/lib/security/encrypt-token.ts` | Tal cual, **sin** el fallback de texto plano (líneas 26-31) |
| Inicio OAuth MP | `src/app/api/mercadopago/route.ts:27-37` | Adaptar: sin sedes, `state` contra cookie |
| Callback OAuth MP | `src/app/api/mercadopago/callback/route.ts:38-92` | Adaptar; usa el SDK `mercadopago` sólo acá |
| Renovación de token | `src/lib/mercadopago/renovar-token.ts` | Lógica tal cual, queries a Drizzle |
| URL + schema zod de `payments/search` | `src/lib/modules/mercadopago/movimientos-map.ts` | Tal cual |
| Paginación de pagos aprobados | `src/lib/modules/mercadopago/movimientos.ts:43-76` | Tal cual |
| Sync (upsert por `mpPagoId`) | `src/lib/modules/mercadopago/movimientos.ts:87-148` | Reescribir en Drizzle (`onConflictDoUpdate`) |
| Estado de facturación de un movimiento | `src/lib/modules/mercadopago/movimientos-vinculo.ts` | Simplificar: acá no hay PAGO/VENTA, todo es "suelto" |
| Cliente HTTP Facturante | `src/lib/facturante/client.ts` | Tal cual (token 23 h en memoria, retry 401, timeouts) |
| Mappers, tipos, errores | `src/lib/facturante/{mappers,types,errors,sell-condition,pdf-url}.ts` | Tal cual, quitando lo de suscripciones/alumnos |
| Reserva idempotente del comprobante | `src/lib/modules/facturacion/reservar.ts` | Reescribir: P2002 → código `23505` de Postgres |
| Envío y clasificación del desenlace | `src/lib/modules/facturacion/enviar.ts:78-151` | Reescribir en Drizzle, misma clasificación |
| Consulta de estado | `client.ts:347-392` | Tal cual |
| Nota de crédito | `mappers.ts:589-638` (`mapNotaCreditoRequest`) | Tal cual |
| Gotchas | `tasks/lessons.md:89-97,138-226`, `docs/facturacion-electronica/PLAN.md` (Apéndice A) | **Leer antes de la Tarea 5** |

## Mapa del código actual (Gorros)

| Qué | Dónde |
| --- | --- |
| Receta para sumar un módulo al panel | [docs/COMO-AGREGAR-MODULO.md](../COMO-AGREGAR-MODULO.md) |
| Ejemplo a copiar: listado con filtros por `searchParams` | [clientes/page.tsx](../../app/(admin)/admin/(panel)/clientes/page.tsx) |
| Ejemplo a copiar: actions detrás de un guard propio | [clientes/cuenta-actions.ts](../../app/(admin)/admin/(panel)/clientes/cuenta-actions.ts) |
| Piezas de formulario (`FormState`, `<Aviso>`, `<Submit>`) | [(panel)/form-ui.tsx](../../app/(admin)/admin/(panel)/form-ui.tsx) |
| Estilos comunes del panel | [admin.module.css](../../app/(admin)/admin/admin.module.css) |
| Navegación | [(panel)/nav-links.tsx](../../app/(admin)/admin/(panel)/nav-links.tsx) y su `layout.tsx` (`showUsers`) |
| Reglas de permisos | [lib/auth/permissions.ts](../../lib/auth/permissions.ts) (`canManageCuentaCorriente` es el modelo) |
| Guards | [lib/auth/index.ts](../../lib/auth/index.ts) (`requireCuentaCorriente` es el modelo) |
| Schema y convenciones | [lib/db/schema.ts](../../lib/db/schema.ts) — uuid, centavos, `withTimezone`, `isActive` |
| `clientes.documento` / `razonSocial` | `lib/db/schema.ts` (tabla `clientes`) |
| Módulo que degrada sin credenciales (modelo para env) | [lib/content/bucket.ts](../../lib/content/bucket.ts) |
| Env documentado | [.env.example](../../.env.example) |
| Última migración | `drizzle/0008_tense_newton_destine.sql` → la nueva es la `0009` |

## Decisiones ya tomadas (NO volver a preguntar)

1. **Facturante, no WSFE directo.** El cliente ya está dado de alta ahí y el
   cliente de Clicnet está probado. No hay certificados en Gorros.
2. **Un solo emisor, configurado por env.** Gorros factura con un único CUIT y un
   único punto de venta: las credenciales de Facturante van como variables de
   entorno, no en una tabla. Si algún día hay dos razones sociales, eso se mueve
   a una tabla.
3. **MP por OAuth, como Clicnet**, con tokens cifrados en `cuentas_mp` y
   renovación de a una cuenta por día (refrescar en ráfaga da 429 y además
   invalida los tokens vigentes). La tabla admite más de una cuenta, pero la UI
   asume una.
4. **Sólo pagos recibidos**: `GET /v1/payments/search` con `status=approved` y
   `range=date_approved`. No se listan retiros, comisiones ni transferencias
   salientes.
5. **La fecha que vale para facturar es `date_approved`**, no `date_created`.
6. **Letra por receptor, en cada factura** (en Clicnet la letra era fija por
   CUIT; acá no):
   - **B** (Facturante `documentType` 3) → consumidor final. Sin documento: tipo
     "Otro" con número `0`. Con DNI o CUIT, opcional, se manda y el
     `taxTreatment` sigue siendo Consumidor Final.
   - **A** (`documentType` 1) → receptor con CUIT y condición RI o Monotributo.
     Se elige un cliente de la tabla `clientes` o se carga el CUIT a mano. Si
     se elige un cliente al que le falta la condición IVA, se le guarda.
7. **Importe**: un solo ítem por el monto bruto del cobro, IVA 21% incluido
   (`priceType` 2, vat id **7** de Facturante — no el 5). Concepto **Bienes**
   (`good` 1), así no hacen falta fechas de servicio. Condición de venta 6
   (pago electrónico). Descripción del ítem: la del pago de MP o, si viene
   vacía, "Vinos y productos".
8. **Emisión asincrónica.** Facturante tarda 13-20 s. La action reserva la fila
   (`pendiente`) y despacha el POST en `after()`. Si no hay respuesta usable,
   la fila queda `en_proceso`, **nunca en error** — reintentar a ciegas duplica
   facturas. La pantalla se refresca sola mientras haya algo en proceso, y hay
   un botón "Consultar estado".
9. **Sin webhook de Facturante en esta iteración.** Para resolver los
   `en_proceso` alcanza con la consulta manual y el cron diario.
10. **Nota de crédito siempre por el total**, con la misma letra que la factura y
    `fiscalAssociations` a la original. La factura no se edita ni se borra:
    queda `anulado` y el movimiento vuelve a poder facturarse.
11. **Sólo `admin`** ve y emite: es plata y es fiscal. Regla nueva
    `canFacturar` en `permissions.ts`.
12. **Cron diario** como servicio cron de Railway: corre `scripts/cron-diario.mjs`,
    que llama a `POST /api/cron/diario` con `Authorization: Bearer $CRON_SECRET`.
    El route hace tres cosas, cada una aislada de las otras: sync de pagos de
    los últimos 7 días, reconciliación de `en_proceso` y renovación de un token
    de MP.

### Ajustes tras revisar el proceso de Clicnet (2026-10-23)

Revisión completa del código, los tests, la memoria y los docs de Clicnet, más
chequeos de sólo lectura sobre la cuenta de Gonzalo. Reemplazan a lo de arriba
donde choquen.

13. **La letra no se elige: sale de la condición del receptor.** Con emisor RI,
    receptor RI o Monotributo → A; consumidor final o exento → B. Si no
    coincide, Facturante rechaza con `100050` ("Tipo Informado 3 - Tipo
    Correcto 1"). `taxTreatment`: 1 RI, 3 Exento, 4 Consumidor Final, 5
    Monotributo (el 5 está **inferido** en Clicnet: confirmarlo con la primera
    A a un monotributista).
14. **La A lleva domicilio del receptor con código de provincia** (`AR-B`,
    `AR-CF`…). Sin domicilio, Facturante imprime el de la sucursal del emisor
    como si fuera del cliente. Con domicilio sin `state` → 100029; con `state`
    que no es un código → 100030.
15. **Webhook de Facturante, por documento** (`header.settings.integrationDetails.webHooks`),
    con `resource: "ElectronicDocument"`, header `facturante-content-type:
    application/json` (si no, llega en XML) y un header secreto propio.
    Facturante pega a `<url>/ElectronicDocument`, así que la ruta es
    catch-all: `app/api/webhooks/facturante/[[...resource]]/route.ts`. Payload
    en PascalCase (`ShortFullNumber` es el corto; `FullNumber`, el largo). Se
    matchea por `ExternalId`. **Revierte la decisión 9**: es la única forma
    automática de cerrar un timeout. Sólo funciona desplegado (URL pública).
16. **Facturante no deduplica por `externalId`** (probado en Clicnet). Un
    timeout sin `facturanteId` queda `en_proceso` y **no se reintenta solo**:
    si en 2 minutos no llegó el webhook, la pantalla dice "revisar en
    Facturante" y ofrece marcarla como no emitida (libera el cobro) recién
    después de mirar el panel.
17. **La búsqueda `GET /company/{id}/ElectronicDocument?searchedWord=` anda con
    esta cuenta** (en Clicnet daba 401), **pero no matchea por `externalId`**:
    probado, "manual-frigoni-fa" da 0 resultados. Sirve para listar, no para
    resolver timeouts. Con `facturanteId` sí se consulta el estado.
18. **La fecha del comprobante se calcula en hora de Argentina**, no en UTC: entre
    las 21 y las 24 Clicnet fecha "mañana", y con facturas manuales de hoy eso
    choca con 100014 (hay una posterior).
19. **Los códigos de ARCA de 5 dígitos** (10015, 10016, 10035…) son de
    validación, no reintentables (Clicnet los clasificaba mal).
20. **Fechas en ISO** `yyyy-MM-ddT00:00:00` (con dd/mm, AFIP rechaza con 10016).
    `pos` es el id **interno** (13665), no el prefijo. En la NC,
    `fiscalAssociations.posPrefix` es entero (15) y `date` se copia literal del
    request de la factura.
21. **Primera A desde Gorros con centavos**, para verificar que `total` = bruto
    con `priceType 2` + `vat 7` (nunca se probó con centavos), y después su NC A.

### Confirmado por el usuario tras la revisión (2026-10-23)

22. **El diseño ajustado (13-21) está aprobado.**
23. **La primera emisión real se hace desplegado en Railway**, no desde local:
    así ya corre con el webhook. Local sirve para ver la pantalla y el sync.
24. **Monotributo queda deshabilitado** (`letraPara` devuelve `null`) hasta
    verificar el `taxTreatment` 5 con una emisión.

### Decisiones de implementación

25. **Una página por cobro** (`/admin/facturacion/[id]`) en vez de un diálogo: el
    panel no tiene diálogos, y la página muestra a la vez el historial de
    comprobantes del cobro, el formulario y las acciones (anular, consultar,
    marcar no emitido). En mobile es más simple.
26. **El domicilio de la A se carga en el formulario.** `clientes` tiene
    `direccion` pero no provincia: se precarga la calle y la provincia se elige
    cada vez. Si molesta, sumar `clientes.provincia`.
27. **`pendiente` sin `enviadoEn` de más de 10 minutos = no salió**: el envío
    marca `en_proceso` *antes* del POST, así que un pendiente viejo es un
    `after()` que nunca corrió. El cron lo libera.
28. **Sin `FACTURANTE_POS_PREFIX` ni `EMISOR_RAZON_SOCIAL`**: el prefijo para la
    NC sale del comprobante (`fiscalData.pos` o el número), como en Clicnet, y
    la razón social la imprime Facturante.

**Estado de la cuenta, verificado 2026-10-23 (sólo lectura):** POS 13665 VÁLIDO,
modo CAE, con libros FA (1/1), FB (1/3), NCA (2/1) y NCB (2/3). Ya existe
**`FA 00015-00000001`**, autorizada hoy 16:28 por $140.000 a un RI, con
`externalId` `manual-frigoni-fa-20261023-mallmann` — **no la emitió esta
iteración**: la emitió otra sesión desde Clicnet, a pedido del usuario. O sea
que la primera A de la cuenta ya salió bien con `taxTreatment` 1. Es la referencia real de una A: `receiver.taxTreatmentId 1`,
`documentTypeId 1` (CUIT), CAE en `fiscalData.nationalAuthorizationCode`,
`fiscalQrUrl` de AFIP.

## Fuera de alcance

- Facturación automática al entrar un pago (el cron sólo sincroniza).
- Webhooks de MP y de Facturante.
- Notas de crédito parciales, facturas con varios ítems, factura manual sin pago
  de MP detrás.
- Copia propia del PDF en el bucket: se linkea el de Facturante.
- Checkout de MP en la tienda (`VENTAS_ACTIVAS` sigue en `false`).
- Varias cuentas de MP en la UI.

---

## Archivos

- **Crear** `lib/crypto/tokens.ts` — cifrado de tokens (port de `encrypt-token.ts`).
- **Crear** `lib/mercadopago/{oauth,token,pagos,sync}.ts` — OAuth y renovación,
  lectura del token, cliente de `payments/search`, sync contra la base.
- **Crear** `app/api/mercadopago/route.ts` y `app/api/mercadopago/callback/route.ts`.
- **Crear** `lib/facturante/{client,mappers,types,errors,config}.ts` — el port, más
  `config.ts`, que lee el emisor de env y degrada si falta.
- **Crear** `lib/facturacion/{cuit,reglas,reservar,enviar,emitir,anular,reconciliar}.ts`
  — dígito verificador, validación letra↔receptor, ciclo de vida del comprobante.
- **Crear** `app/(admin)/admin/(panel)/facturacion/` — `page.tsx` (movimientos),
  `actions.ts`, `emitir-dialog.tsx`, `auto-refresh.tsx`, `facturacion.module.css`,
  `comprobantes/page.tsx`, `cuenta-mp/page.tsx`.
- **Crear** `app/api/cron/diario/route.ts` y `scripts/cron-diario.mjs`.
- **Modificar** `lib/db/schema.ts` — tablas y enums nuevos, y `clientes.condicionIva`.
- **Modificar** `lib/auth/permissions.ts` y `lib/auth/index.ts` — `canFacturar` y
  `requireFacturacion`.
- **Modificar** `(panel)/layout.tsx` y `nav-links.tsx` — ítem "Facturación" en
  Negocio, sólo si `showFacturacion`.
- **Modificar** `clientes` (form y detalle) — campo condición IVA.
- **Modificar** `.env.example`, `docs/ARQUITECTURA.md`.
- **Dependencia nueva**: `mercadopago` (SDK oficial), sólo para el intercambio
  OAuth. Todo lo demás es `fetch`.

---

## Tarea 0: credenciales

- [x] **Paso 1**: credenciales de Facturante en `.env.local`. **No estaban en
      Clicnet** (ni en la base local ni en la de producción: sus 15
      `FacturanteConfig` son sedes del gimnasio). Las pasó el usuario:
      - Empresa `FRIGONI, GONZALO` · CUIT 20-16068090-4 · RI · companyId
        2708588, delegada a la revendedora de Clicnet.
      - Sucursal "Central" (subsidiaryId 11163) · POS 00015 (id 13665), modo
        CAE, ambiente **producción** (`https://sync.facturante.com`).
      - Usuario `Gorros@clicpilates.com` — **no** sigue el patrón
        `<CUIT>@clicpilates.com` de las cuentas de Clicnet.
      - Verificado el 2026-10-23: token OK y `GET /Pos/13665` → VÁLIDO. El libro
        de Factura A (`typeId` 1) está en `lastNumber` 0: la primera A que
        salga de acá es la primera de la cuenta. Ya emitió 216 B y 3 NC B
        desde el panel de Facturante.
- [x] **Paso 2**: app de MP **propia de Gorros**, creada por el usuario. `MP_APP_ID`,
      `MP_CLIENT_SECRET` y `MP_REDIRECT_URI` en `.env.local`. Redirect URIs a
      registrar en la app: `http://localhost:3001/api/mercadopago/callback` y la
      de producción.
- [x] **Paso 2b**: **se prueba en producción, con la cuenta real de Gonzalo**
      (decisión del usuario, 2026-10-23). En el peor caso, se anula con nota de
      crédito. **Antes de la primera emisión** va la revisión completa del
      proceso contra el de Clicnet (ver Tarea 6, Paso 0): payload armado y
      mostrado, sin enviarlo, comparado campo por campo con uno real que
      Clicnet haya autorizado.
- [x] **Paso 3**: `MP_TOKEN_ENCRYPTION_KEY` (32 bytes en hex) y `CRON_SECRET`
      generados en `.env.local` del worktree, **nunca** al repo.
- [ ] **Verificar**: las variables están en `.env.local` y documentadas (sin valores)
      en `.env.example`.

## Tarea 1: schema y migración

**Archivos:** modificar `lib/db/schema.ts`

- [ ] **Paso 1**: enums `condicion_iva` (`responsable_inscripto`, `monotributo`,
      `exento`, `consumidor_final`), `comprobante_tipo` (`factura`,
      `nota_credito`), `comprobante_letra` (`A`, `B`) y `comprobante_estado`
      (`pendiente`, `en_proceso`, `autorizado`, `rechazado`, `error`, `anulado`).
- [ ] **Paso 2**: `cuentas_mp` — `alias`, `mpUserId` (**unique**: en Clicnet
      faltó y terminó facturando contra el CUIT equivocado),
      `accessTokenCifrado`, `refreshTokenCifrado`, `publicKey`, `expiresAt`,
      `isActive`, `vinculadaPor` → users, timestamps.
- [ ] **Paso 3**: `movimientos_mp` — `cuentaId` → cuentas_mp, `mpPagoId` (text,
      unique), `montoCentavos`, `netoCentavos?`, `comisionCentavos?`, `titular?`,
      `email?`, `docTipo?`/`docNumero?` del pagador (para precargar el
      receptor), `metodoPago?`, `descripcion?`, `fechaAprobacion`, `raw` jsonb,
      timestamps. Índice `movimientos_mp_fecha_idx` sobre `fechaAprobacion`.
- [ ] **Paso 4**: `comprobantes` — `movimientoId` → movimientos_mp, `tipo`, `letra`,
      `estado`, `externalId` (unique; formato `GORROS-M<movimiento>-<tipo>-<n>`),
      `facturanteId?`, `cae?`, `caeVencimiento?`, `numeroCompleto?`, `pdfUrl?`,
      `qrUrl?`, `totalCentavos`, `receptorDocTipo`, `receptorDocNumero`,
      `receptorNombre?`, `receptorCondicionIva`, `clienteId?` → clientes,
      `origenId?` → comprobantes (NC), `errorCodigo?`, `errorMensaje?`,
      `requestPayload` y `responsePayload` jsonb, `emitidoPor` → users,
      `enviadoEn?`, timestamps.
      **Unique parcial** `comprobantes_factura_viva_idx` sobre `movimientoId`
      `where tipo = 'factura' and estado not in ('rechazado','error','anulado')`:
      la base, no la UI, impide facturar dos veces el mismo cobro.
- [ ] **Paso 5**: `clientes.condicionIva` nullable.
- [ ] **Verificar**: `npm run db:generate` produce `0009_*.sql` **sólo aditivo**
      (CREATE TYPE / CREATE TABLE / ADD COLUMN); `npm run db:migrate` corre
      contra la base compartida; `npx tsc --noEmit` en verde.

## Tarea 2: permisos y navegación

**Archivos:** `lib/auth/permissions.ts`, `lib/auth/index.ts`, `(panel)/layout.tsx`, `nav-links.tsx`

- [ ] **Paso 1**: `canFacturar(actor) => actor.role === "admin"`, con el porqué al
      estilo de `canManageCuentaCorriente`. Actualizar `ROLE_DESCRIPTION.admin`.
- [ ] **Paso 2**: `requireFacturacion()` en `index.ts`, que redirige a `/admin`.
- [ ] **Paso 3**: ítem "Facturación" en el grupo Negocio, con prop `showFacturacion`.
- [ ] **Verificar**: con un usuario `editor` el ítem no aparece y `/admin/facturacion`
      redirige; con `admin` aparece.

## Tarea 3: Mercado Pago — OAuth y cuenta

**Archivos:** `lib/crypto/tokens.ts`, `lib/mercadopago/{oauth,token}.ts`, `app/api/mercadopago/**`, `facturacion/cuenta-mp/page.tsx`

- [ ] **Paso 1**: portar `encrypt-token.ts` → `lib/crypto/tokens.ts`. Sin
      fallback de texto plano: si no descifra, error.
- [ ] **Paso 2**: `GET /api/mercadopago` exige `requireFacturacion()` y redirige a
      `auth.mercadopago.com.ar/authorization` con un `state` aleatorio guardado
      en cookie httpOnly (el route handler sí puede escribir cookies).
- [ ] **Paso 3**: callback — valida que el `state` coincida con la cookie, cambia el
      `code` por tokens (SDK `mercadopago`, sólo acá) y hace upsert en
      `cuentas_mp` por `mpUserId`, con tokens cifrados.
- [ ] **Paso 4**: `token.ts` — `obtenerTokenMP(cuentaId)` descifra **sin renovar**;
      `renovarUnaCuenta()` renueva la que vence antes, con el UPDATE
      condicionado al refresh token viejo (port de `renovar-token.ts:78-87`).
- [ ] **Paso 5**: `cuenta-mp/page.tsx` — estado de la cuenta (alias, user id, vence
      el …), botón "Vincular" / "Volver a vincular" y "Desactivar".
- [ ] **Verificar**: vincular la cuenta real del local en `:3001` y ver la fila en
      `cuentas_mp` con los tokens cifrados (no legibles en `db:studio`).

## Tarea 4: Mercado Pago — pagos y sync

**Archivos:** `lib/mercadopago/{pagos,sync}.ts`

- [ ] **Paso 1**: portar `movimientos-map.ts` y `buscarPagosAprobados`
      (`limit=50`, offset hasta `paging.total`, tope de 40 páginas, corte ante
      página vacía). Montos a centavos con `Math.round(x * 100)`.
- [ ] **Paso 2**: `sincronizarPagos({ desde, hasta })` — por cada cuenta activa,
      upsert en `movimientos_mp` por `mpPagoId`. Una cuenta que falla no frena a
      las otras. Devuelve `{ nuevos, actualizados, errores }`.
- [ ] **Verificar**: correr el sync de los últimos 30 días y comparar la cantidad y la
      suma contra la actividad del panel de MP.

## Tarea 5: Facturante — cliente y reglas

**Archivos:** `lib/facturante/*`, `lib/facturacion/{cuit,reglas}.ts`

- [ ] **Paso 0**: leer los gotchas de Clicnet (`tasks/lessons.md:138-226` y el
      Apéndice A de `docs/facturacion-electronica/PLAN.md`).
- [ ] **Paso 1**: portar `client.ts`, `types.ts`, `errors.ts`, `sell-condition.ts` y
      `pdf-url.ts`. Éxito por `body.communicationStatus` (200/201), no por el
      status HTTP.
- [ ] **Paso 2**: `config.ts` — lee `FACTURANTE_*` y `EMISOR_CUIT`, y expone
      `facturacionConfigurada()` para que la pantalla avise en vez de romper.
- [ ] **Paso 3**: `mappers.ts` — sólo `mapFacturaRequest` y `mapNotaCreditoRequest`,
      parametrizados por letra y receptor (decisión 6). Documento sin guiones
      (error 100045). **No** mandar `header.address`: si va, exige `state` con
      formato "AR-B" (100029/100030).
- [ ] **Paso 4**: `cuit.ts` — validación de 11 dígitos con dígito verificador
      (módulo 11).
- [ ] **Paso 5**: `reglas.ts` — `validarReceptor(letra, receptor)`. A exige CUIT
      válido y condición RI o Monotributo. B con "Otro" exige número `0`
      (error 10015) y, a partir de `UMBRAL_IDENTIFICACION_B`, exige DNI o CUIT
      (constante con comentario y fecha: **confirmar el valor vigente de ARCA**).
- [ ] **Paso 6**: confirmar los `taxTreatment` contra los maestros de Facturante en
      testing: en Clicnet el 3 y el 4 estuvieron invertidos. Validar leyendo
      `governmentEntityData.CondicionIVAReceptorId` de la respuesta.
- [ ] **Verificar**: `GET /Pos/{posId}` contra testing responde OK con las credenciales
      del cliente; `tsc` en verde.

## Tarea 6: ciclo de vida del comprobante

**Archivos:** `lib/facturacion/{reservar,enviar,emitir,anular,reconciliar}.ts`

- [ ] **Paso 1**: `reservar` — INSERT `pendiente`; si choca con el unique parcial
      (`23505`), "ese cobro ya tiene factura".
- [ ] **Paso 2**: `enviar` — POST con timeout de 45 s y clasificación del desenlace
      (port de `enviar.ts:78-151`): CAE → `autorizado`; rechazo fiscal →
      `rechazado` con código y mensaje; sin respuesta usable → `en_proceso`.
      Se guardan siempre el `requestPayload` y el `responsePayload`.
- [ ] **Paso 3**: `emitir(movimientoId, receptor, letra)` — valida, reserva y
      despacha `enviar` en `after()`. Si `clienteId` viene sin condición IVA, se
      la guarda al cliente.
- [ ] **Paso 4**: `anular(comprobanteId)` — sólo sobre una factura `autorizado`:
      reserva la NC con `origenId`, la envía y, si sale autorizada, pasa la
      factura a `anulado`.
- [ ] **Paso 5**: `reconciliar(comprobanteId | todos)` — consulta el estado de cada
      `en_proceso` y lo resuelve.
- [ ] **Verificar**: en testing, una B anónima, una B con DNI, una A a un RI y una NC
      de la A. Las cuatro con CAE y PDF. Cortar la red a mitad de una emisión y
      ver que queda `en_proceso` y que se resuelve con "Consultar estado".

## Tarea 7: pantalla de movimientos

**Archivos:** `facturacion/{page.tsx,actions.ts,emitir-dialog.tsx,auto-refresh.tsx,facturacion.module.css}`

- [ ] **Paso 1**: `page.tsx` con filtros por `searchParams`: desde/hasta (30 días por
      defecto), estado (`sin facturar`, `facturados`, `en proceso`, `con
      error`, todos) y búsqueda por titular o email. Columnas: fecha de
      aprobación, titular, medio, bruto, comisión, neto, estado de facturación
      con número y link al PDF, acción. Totales del filtro arriba. Tope de 300
      filas.
- [ ] **Paso 2**: si falta la cuenta de MP o la config de Facturante, un aviso con link
      a qué hacer en vez de la tabla.
- [ ] **Paso 3**: `actions.ts` (todas detrás de `requireFacturacion()`, zod,
      `revalidatePath`): `sincronizarAction`, `emitirAction`, `anularAction`,
      `consultarEstadoAction`.
- [ ] **Paso 4**: `emitir-dialog.tsx` — `useActionState`. Elección B/A.
      B: documento opcional, precargado con el del pagador de MP. A: buscador
      de `clientes` (razón social y CUIT) o carga manual de CUIT, razón social y
      condición. Resumen con neto e IVA discriminado antes de confirmar.
- [ ] **Paso 5**: `auto-refresh.tsx` — `router.refresh()` cada 5 s mientras haya
      filas `en_proceso`, con tope de 2 minutos.
- [ ] **Verificar**: en el navegador, en `:3001`, el flujo completo de la Tarea 6
      desde la pantalla; mobile a 375 px sin scroll horizontal de página.

## Tarea 8: listado de comprobantes y clientes

**Archivos:** `facturacion/comprobantes/page.tsx`, form de clientes

- [ ] **Paso 1**: listado de comprobantes (fecha, número, letra, tipo, receptor, total,
      estado, CAE, PDF), con filtros por período, letra y estado.
- [ ] **Paso 2**: campo "Condición frente al IVA" en el alta y la edición de clientes.
- [ ] **Verificar**: la NC de la Tarea 6 aparece vinculada a su factura; un cliente
      guarda y muestra su condición.

## Tarea 9: cron diario

**Archivos:** `app/api/cron/diario/route.ts`, `scripts/cron-diario.mjs`

- [ ] **Paso 1**: route `POST` que compara `Authorization` contra `CRON_SECRET` con
      `timingSafeEqual`. Corre sync de 7 días, reconciliación y renovación de un
      token, cada una en su `try`. Devuelve un resumen JSON.
- [ ] **Paso 2**: `scripts/cron-diario.mjs` — `fetch` al route con el secret de env;
      sale con código ≠ 0 si algo falló, para que Railway lo marque.
- [ ] **Paso 3**: servicio cron en Railway (mismo repo, comando
      `node scripts/cron-diario.mjs`, schedule `0 9 * * *` UTC = 6 AM Argentina).
      **Confirmar con el usuario antes de crearlo.**
- [ ] **Verificar**: llamarlo a mano en local con el secret (200 con resumen) y sin
      secret (401).

## Tarea 10: documentación

- [ ] **Paso 1**: `.env.example` — cada variable nueva con su comentario, al estilo
      de las de S3.
- [ ] **Paso 2**: `docs/ARQUITECTURA.md` — sección Facturación: flujo, estados, por qué
      `en_proceso` no es un error, cómo se anula.

---

## Migraciones

- [ ] `npm run db:generate` — el SQL queda en `drizzle/0009_*.sql` y se commitea.
- [ ] Es aditiva: tipos y tablas nuevas, más una columna nullable en `clientes`.
      No rompe a otros worktrees que usen la base compartida.

## Cierre

- [ ] `npx tsc --noEmit`
- [ ] `npm run build` (con el dev bajado: ver `tasks/lessons.md`)
- [ ] Probado a mano en `:3001` contra Facturante **testing**
- [ ] Variables cargadas en Railway y pasaje a producción del ambiente de
      Facturante, **confirmado con el usuario**
- [ ] PR mergeado a `main`
- [ ] `./scripts/worktree.ps1 borrar facturacion-mp -borrarRama`

## Review

_(Qué se hizo, qué cambió respecto del plan y por qué, qué quedó pendiente.)_
