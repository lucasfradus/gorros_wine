# Clientes y cuenta corriente — Plan

> **Para quien lo ejecute**: este plan es autocontenido. Todo el contexto
> necesario está acá; no hace falta releer la conversación donde se decidió.
> Antes de tocar código, leer `AGENTS.md` y `tasks/lessons.md`.
> Los pasos van con checkbox (`- [ ]`) y se marcan a medida que avanzan.

**Objetivo:** el panel tiene una sección Clientes con alta, edición y búsqueda, y
cada cliente tiene una cuenta corriente en **dos monedas** donde se anotan cargos
y pagos, con el tipo de cambio que se arregló en cada operación.

**Enfoque:** dos tablas nuevas (`clientes` y `movimientos_cc`) siguiendo la
receta de [COMO-AGREGAR-MODULO.md](../COMO-AGREGAR-MODULO.md). El saldo **no se
guarda**: se calcula sumando los movimientos. La moneda no es una propiedad del
cliente sino de cada movimiento, y el dólar sólo se pesifica cuando se decide
explícitamente.

**Worktree:** `../Gorros-clientes` · rama `feat/clientes` · puerto `:3003`

---

## Contexto

Hoy la base sólo tiene `users` y `sessions`: existe para el panel, no para el
negocio. El propio [lib/db/schema.ts](../../lib/db/schema.ts) lo anticipa — *"un
cliente que compra vinos no es un `user`, va a tener su propia tabla"*.

El negocio maneja dos formas de relación: el cliente **regular**, que paga y se
va, y el de **cuenta corriente**, que se lleva mercadería y salda después. La
operatoria real que hay que soportar, con el caso que disparó esto:

1. El cliente se lleva mercadería por **$5.000.000**.
2. Pasa y deja **USD 2.000** a cuenta de esa deuda. El tipo de cambio se arregla
   en el momento (ese día, 1.200) y **tiene que quedar asentado**.
3. Otras veces deja plata **a favor de compras futuras**. Ese saldo **no se
   pesifica**: queda en dólares hasta que se decida usarlo, y ese día se acuerda
   un tipo de cambio nuevo.

Ninguna de las tres cosas entra en un modelo de una sola moneda ni en un campo
`saldo` mutable.

## Mapa del código actual

| Qué | Dónde |
| --- | --- |
| Schema (hoy `users` y `sessions`) | [lib/db/schema.ts](../../lib/db/schema.ts) |
| Reglas de permisos | [lib/auth/permissions.ts](../../lib/auth/permissions.ts) |
| Guards (`requireUser`, `requireUserManager`) | [lib/auth/index.ts](../../lib/auth/index.ts) |
| CRUD de referencia a copiar | `app/(admin)/admin/(panel)/usuarios/` |
| Clases CSS del panel (ya existen casi todas las que hacen falta) | `app/(admin)/admin/admin.module.css` |
| Formato de fecha | [lib/format.ts](../../lib/format.ts) |
| Formato de pesos sin `Intl` (y por qué) | [lib/data.ts](../../lib/data.ts) — `formatPrice` |
| Navegación del panel | `app/(admin)/admin/(panel)/nav-links.tsx` |
| Receta de módulo nuevo | [COMO-AGREGAR-MODULO.md](../COMO-AGREGAR-MODULO.md) |

## Decisiones ya tomadas (NO volver a preguntar)

1. **Dos saldos parejos.** El cliente puede deber o tener a favor tanto en ARS
   como en USD. Cada movimiento se anota en la moneda en que se pactó.
2. **El saldo se calcula, no se guarda.** `saldo = SUMA(movimientos)` por moneda.
   Un campo `saldo` mutable es la forma clásica de que la cuenta y el historial
   dejen de coincidir sin que nadie sepa cuál de los dos miente.
3. **Regular vs cuenta corriente es un flag**, no dos tipos. `cuentaCorriente`
   habilita fiar, con límite de crédito opcional. El regular que un día pide
   fiado se habilita con un click y sin migrar nada.
4. **Los errores se anulan con contramovimiento**, no se editan ni se borran. El
   saldo de una fecha pasada nunca cambia hacia atrás.
5. **La plata la toca sólo el admin.** El editor ve la ficha y los datos de
   contacto del cliente; no ve saldos ni carga movimientos.
6. **El cliente nace preparado para la web**: `email` único y opcional. No se
   implementa login de clientes ahora, pero cuando exista cuelga de esta tabla
   sin migrar datos.
7. **El cargo se anota con monto + detalle escrito.** El modelo de productos está
   en curso en paralelo; cuando exista, el movimiento se ata a la venta.
8. **No se borran clientes, se archivan** (`isActive`), igual que `users` y por
   la misma razón: en cuanto tengan movimientos colgando, borrar la fila deja
   huérfano el historial.

## Fuera de alcance

- Login de clientes en la tienda. La puerta queda abierta (decisión 6), no se abre.
- Atar los movimientos a ventas o productos. Se agrega cuando exista `ventas`,
  con una migración aditiva de una columna nullable (ver *Migraciones*).
- Facturación, remitos, listas de precios por cliente.
- Paginación del listado. Con el volumen actual sobra una query directa; el día
  que moleste, se agrega.
- Usar un tipo de cambio "del día" como si fuera el pactado. La cuenta corriente
  guarda **siempre** la cotización que se arregló en esa operación, y ninguna
  otra.

  Ojo con esto, que se descubrió a mitad de camino: el catálogo trajo una tabla
  `cotizaciones` (historial del dólar de referencia, para mostrar en pesos los
  importados que la bodega cotiza en USD). **No es lo mismo que la cotización de
  un pago** y no reemplaza nada de acá.

  Cuando se descubrió, esa tabla vivía sólo en `feat/admin-catalogo` y colgarse
  de una rama de feature ajena está prohibido por
  [WORKTREES.md](../WORKTREES.md). **Ya está mergeada en `main`**, así que la
  mejora queda disponible y sin hacer: **sugerir** el número en el formulario de
  pago para no tipearlo, siempre editable, y guardando igual lo que se pactó.
  Queda fuera de esta iteración porque es una decisión de producto, no una
  deuda técnica.

---

## El modelo, explicado

### Cada operación es una o dos filas

Los importes van en **centavos** (`bigint`) y con signo:
**positivo = a favor del cliente, negativo = deuda**.

La clave está en que "me dio dólares" y "los contamos contra la deuda en pesos"
son **dos hechos distintos**, y el segundo es opcional. Por eso son dos filas:
el mismo pago puede quedarse en dólares o convertirse, y el sistema no tiene que
adivinar cuál de las dos cosas pasó.

El caso del contexto, tal como queda cargado:

| Fecha | Tipo | Detalle | Δ ARS | Δ USD | Cotización |
| --- | --- | --- | --- | --- | --- |
| 03/08 | `cargo` | 6 cajas Malbec Reserva | −5.000.000,00 | — | — |
| 12/08 | `pago` | Efectivo en dólares | — | +2.000,00 | — |
| 12/08 | `conversion` | Aplicado a la deuda | +2.400.000,00 | −2.000,00 | 1.200,0000 |
| 20/08 | `pago` | A cuenta de próximas compras | — | +2.000,00 | — |

**Saldo: debe $2.600.000 · a favor USD 2.000.**

Las dos filas del 12/08 las crea **un solo formulario** ("recibí USD 2.000" +
tildar "aplicar a la deuda al TC ___"), en un solo `INSERT` y compartiendo
`grupoId`. Los USD 2.000 del 20/08 se quedan quietos en dólares hasta que un día
se decida usarlos, y ese día es otra `conversion` con **su** cotización.

### Por qué la anulación sale gratis

Anular es agregar la operación inversa. Como el saldo es la suma de todas las
filas, **el original y su contrario se cancelan solos**: no hace falta filtrar
nada al sumar. Lo anulado sólo cambia cómo se *muestra* (tachado), y eso se
resuelve en memoria con los movimientos que la ficha ya cargó.

### Tipos de movimiento

| Tipo | Cuándo | Monedas que mueve |
| --- | --- | --- |
| `saldo_inicial` | Al dar de alta un cliente que ya venía debiendo | ARS y/o USD |
| `cargo` | Se llevó mercadería | una |
| `pago` | Entregó plata | una |
| `conversion` | Se acordó pasar de una moneda a la otra | las dos + cotización |
| `ajuste` | Corrección o redondeo con motivo escrito | una |

### Por qué la cotización se guarda aunque parezca deducible

En una `conversion` el TC se podría despejar dividiendo los dos importes. Se
guarda igual porque **es el número que se estrecharon la mano**, y es lo que el
cliente va a discutir si discute algo. La cotización es el dato de entrada; el
importe en pesos es el que se calcula a partir de ella.

### El límite de crédito es por moneda, y avisa en vez de bloquear

Dos columnas opcionales (`limiteArsCentavos`, `limiteUsdCentavos`) en vez de un
límite total: sin un tipo de cambio global (ver *Fuera de alcance*) un límite
mixto no se puede evaluar sin inventar una cotización.

Pasarse **no bloquea la carga**: muestra un aviso en la ficha y en el listado.
Quien decide fiar de más es el dueño, no el software.

---

## Archivos

- **Modificar** `lib/db/schema.ts` — tablas `clientes` y `movimientos_cc`, enums
  `moneda` y `movimiento_tipo`, tipos inferidos.
- **Modificar** `lib/auth/permissions.ts` — `canManageCuentaCorriente`.
- **Modificar** `lib/auth/index.ts` — `requireCuentaCorriente()`.
- **Modificar** `lib/format.ts` — `formatARS`, `formatUSD`, `formatMonto`.
- **Crear** `lib/cuenta-corriente.ts` — el saldo en un solo lugar: función pura
  sobre movimientos + query agregada para el listado. Archivo aparte de `lib/db`
  porque es regla de negocio, no acceso a datos.
- **Crear** `app/(admin)/admin/(panel)/clientes/page.tsx` — listado, buscador y filtros.
- **Crear** `app/(admin)/admin/(panel)/clientes/nuevo/page.tsx` — alta.
- **Crear** `app/(admin)/admin/(panel)/clientes/[id]/page.tsx` — ficha: datos + cuenta.
- **Crear** `app/(admin)/admin/(panel)/clientes/actions.ts` — actions de cliente.
- **Crear** `app/(admin)/admin/(panel)/clientes/cuenta-actions.ts` — actions de
  movimientos. Archivo aparte porque tienen otro guard (`requireCuentaCorriente`)
  y así no hay forma de mezclarlos por descuido.
- **Crear** `app/(admin)/admin/(panel)/clientes/cliente-forms.tsx` — formularios de datos.
- **Crear** `app/(admin)/admin/(panel)/clientes/cuenta-forms.tsx` — formularios de movimientos.
- **Crear** `app/(admin)/admin/(panel)/clientes/clientes.module.css` — sólo lo que
  no cubra `admin.module.css` (tabla de movimientos, cabecera de saldos).
- **Modificar** `app/(admin)/admin/(panel)/nav-links.tsx` — enlace a Clientes.
- **Modificar** `docs/ARQUITECTURA.md` — mapa de rutas y "de dónde salen los datos".

---

## Tarea 1: Schema y migración

**Archivos:** modificar `lib/db/schema.ts`

- [x] **Enum**: `movimientoTipo` (`saldo_inicial`, `cargo`, `pago`, `conversion`,
      `ajuste`).

      **Sin enum `moneda`**, aunque el plan original lo pedía. Ninguna columna lo
      usaba —los importes van en `deltaArsCentavos` y `deltaUsdCentavos`, que es
      justamente lo que deja que una `conversion` mueva las dos monedas a la
      vez— así que era un tipo de Postgres al pedo. Y encima chocaba: el catálogo
      ya declara `pgEnum("moneda")` para el precio de lista y su migración ya
      está aplicada en la base compartida, así que la mía fallaba con
      `type "moneda" already exists`. El tipo de TypeScript para los
      formularios vive en `lib/cuenta-corriente.ts`, que es donde hacía falta.
- [x] **Tabla `clientes`**: `nombre` (notNull), `apodo`, `telefono`, `email`
      (`.unique()` — en Postgres el UNIQUE deja pasar varios NULL, así que sirve
      tal cual para "único cuando está"; normalizar a minúscula al escribir, como
      `users`), `documento` (CUIT o DNI, como **texto**: tiene ceros a la
      izquierda y guiones), `razonSocial`, `direccion`, `notas`,
      `cuentaCorriente` (boolean, default `false`), `limiteArsCentavos` y
      `limiteUsdCentavos` (bigint nullable), `isActive`, `createdAt`, `updatedAt`.
- [x] **Tabla `movimientos_cc`**: `clienteId` (FK, `onDelete: "restrict"`),
      `fecha` (la del hecho, editable — a veces se carga al día siguiente),
      `tipo`, `detalle` (notNull), `deltaArsCentavos` y `deltaUsdCentavos`
      (bigint `{ mode: "number" }`, notNull, default 0), `cotizacion`
      (`numeric(14, 4)` nullable), `grupoId` (uuid notNull — la operación;
      las filas son sus patas), `anulaGrupoId` (uuid nullable — qué operación
      anula ésta), `creadoPor` (FK a `users`, `onDelete: "set null"`), `createdAt`.
- [x] Índices: `movimientos_cliente_fecha_idx` sobre `(clienteId, fecha)` y
      `movimientos_grupo_idx` sobre `grupoId`.
- [x] Comentarios en castellano explicando **por qué**, no qué (tono de
      `lib/auth/session.ts`). Los que importan: por qué el saldo no es una
      columna, por qué el importe va en centavos, por qué `documento` es texto,
      y qué es un `grupoId`.
- [x] **Verificar**: `npm run db:generate` genera un SQL puramente aditivo (dos
      `CREATE TABLE`, dos `CREATE TYPE`, ningún `DROP` ni `ALTER` sobre lo
      existente), `npm run db:migrate` lo aplica, y `npm run db:studio` muestra
      las dos tablas vacías.

## Tarea 2: Permisos y helpers de saldo

**Archivos:** modificar `lib/auth/permissions.ts`, `lib/auth/index.ts`,
`lib/format.ts` · crear `lib/cuenta-corriente.ts`

- [x] ~~`canManageClientes(actor)` → `true` (admin y editor).~~ **No existe, y
      es mejor así.** El plan la pedía "para que la regla viva en un solo
      lugar", pero mientras esta iteración avanzaba el repo fijó la convención
      contraria, y tiene razón: un permiso que siempre devuelve `true` es una
      indirección que hay que ir a leer para descubrir que no decidía nada.
      Bodegas, Productos y Eventos no la tienen. La ficha del cliente la editan
      los dos roles, así que alcanza con `requireUser()`. El comentario que lo
      explica está en `lib/auth/permissions.ts`.
- [x] `canManageCuentaCorriente(actor)` → `actor.role === "admin"`.
- [x] `requireCuentaCorriente()` en `lib/auth/index.ts`, al lado de
      `requireUserManager()`.
- [x] `formatARS(centavos)` y `formatUSD(centavos)` en `lib/format.ts`. Sin
      `Intl`, con el mismo truco de separador de miles que `formatPrice` en
      `lib/data.ts` — es una decisión tomada para que el servidor y el cliente
      formateen igual y no haya desajuste de hidratación. Decimales sólo cuando
      no son cero.
- [x] `lib/cuenta-corriente.ts`: tipo `Saldo { arsCentavos, usdCentavos }`,
      `saldoDe(movimientos)` (función pura, para la ficha) y
      `saldosPorCliente(clienteIds)` (una sola query agregada con `GROUP BY`,
      para el listado — nunca una query por fila).
- [x] **Verificar**: `npx tsc --noEmit` en verde.

## Tarea 3: CRUD de clientes

**Archivos:** crear `clientes/actions.ts`, `page.tsx`, `nuevo/page.tsx`,
`[id]/page.tsx`, `cliente-forms.tsx`, `clientes.module.css` · modificar
`nav-links.tsx`

- [x] `actions.ts` con `crearClienteAction`, `actualizarClienteAction` y
      `archivarClienteAction`, en el orden de siempre:
      **autorizar → validar (zod) → reglas → escribir → `revalidatePath`**.
      Estado `{ error?: string; ok?: string }`.
- [x] La autorización va **también en la action**, no sólo en la página: una
      Server Action es un endpoint HTTP y se puede invocar sin pasar por la
      pantalla.
- [x] Zod v4: `z.email()` suelto, no `z.string().email()`. Errores desde
      `parsed.error.issues[0].message`, escritos para quien los lee ("Ya hay un
      cliente con ese mail", no "unique violation").
- [x] Listado con buscador (`?q=` sobre nombre, apodo, teléfono y documento con
      `ilike`) y filtro por estado (todos / con cuenta corriente / con deuda /
      archivados). Las columnas de saldo y el filtro por deuda sólo si
      `canManageCuentaCorriente`.
- [x] Alta y ficha con `useActionState` de React 19 (no `useFormState`).
      En el alta, el saldo inicial (ARS y/o USD) aparece **sólo para admin**.
- [x] Enlace "Clientes" en `nav-links.tsx`, sección Negocio, siempre visible.
- [x] **Verificar**: `npx tsc --noEmit`, y en el navegador: crear un cliente,
      editarlo, buscarlo por apodo, archivarlo y verlo desaparecer del listado
      por defecto.

## Tarea 4: Cuenta corriente

**Archivos:** crear `clientes/cuenta-actions.ts`, `cuenta-forms.tsx` · modificar
`clientes/[id]/page.tsx`

- [x] `cuenta-actions.ts`, todas detrás de `requireCuentaCorriente()`:
      - `registrarCargoAction` — monto, moneda, fecha, detalle.
      - `registrarPagoAction` — monto, moneda, fecha, detalle, y opcionalmente
        "aplicar a la deuda" con cotización: eso agrega la fila `conversion`
        con el mismo `grupoId`. Las dos filas van en **un solo `INSERT`**, que
        ya es atómico — no hace falta abrir una transacción para eso.
      - `registrarConversionAction` — usar saldo a favor de una moneda contra la
        deuda de la otra, con la cotización de hoy.
      - `registrarAjusteAction` — con motivo obligatorio.
      - `anularOperacionAction` — inserta la operación inversa con
        `anulaGrupoId` apuntando a la original. **Nunca** `UPDATE` ni `DELETE`
        sobre un movimiento existente.
- [x] Validaciones de negocio: montos `> 0`, cotización `> 0`, fecha no futura,
      y no anular dos veces la misma operación.
- [x] Ficha del cliente: cabecera con los dos saldos (y el aviso de límite si se
      pasó), y debajo el extracto en orden cronológico inverso, con las filas
      anuladas tachadas y las patas de una misma operación agrupadas visualmente.
- [x] **Verificar**: cargar el caso exacto del contexto (deuda de $5.000.000,
      pago de USD 2.000 aplicado a 1.200, y USD 2.000 a favor) y que la ficha
      diga **debe $2.600.000 · a favor USD 2.000**. Después anular el pago y que
      el saldo vuelva a $5.000.000 sin que desaparezca ninguna fila del extracto.

## Tarea 5: Cierre de documentación

**Archivos:** modificar `docs/ARQUITECTURA.md`

- [x] Actualizar el mapa de rutas y la sección "De dónde salen los datos" (deja
      de ser cierto que "la base sólo tiene `users` y `sessions`").
- [x] ~~Los docs describían **tres roles** (`owner`/`admin`/`editor`) cuando el
      commit 5523064 los dejó en dos.~~ Ya no hace falta: lo arregló de paso el
      merge de `feat/cms-contenido`.

**Ojo — esta tarea quedó pendiente a propósito.** Mientras esta iteración
avanzaba, `feat/cms-contenido` se mergeó a `main` y reescribió los dos
documentos (sumó el CMS, las imágenes y el mapa de rutas). Editarlos desde esta
rama, que salió de la `main` vieja, sería fabricar un conflicto grande en un
archivo de prosa. **Primero se integra `main`, después se tocan los docs.**

---

## Migraciones

- [x] `npm run db:generate` — el SQL queda en `drizzle/` y **se commitea**.
- [x] Es **aditiva**: dos tablas nuevas y dos enums nuevos, sin tocar `users` ni
      `sessions`. No hace falta base aparte; la compartida de
      [WORKTREES.md](../WORKTREES.md) alcanza.
- [x] **Chocó, tal como estaba previsto.** `feat/cms-contenido` se mergeó a
      `main` primero y se quedó con el `0002` (`0002_watery_dormammu.sql`). Esta
      rama tiene su propio `0002_absent_sinister_six.sql`, y las dos tocan
      `drizzle/meta/_journal.json`.

- [x] **Al integrar `main`**: borrar `drizzle/0002_absent_sinister_six.sql` y
      `drizzle/meta/0002_snapshot.json`, quedarse con el `_journal.json` de
      `main`, y correr `npm run db:generate` de nuevo para que salga como
      `0003` sobre el schema ya mergeado. El conflicto del journal **no se
      resuelve a mano**.

      La base compartida ya tiene las tablas aplicadas, así que la migración
      regenerada va a encontrarlas y no hay nada que rehacer ahí.

- [x] El enum `moneda` no da problema: esta rama **no lo declara** (ver Tarea 1),
      así que el único que lo crea es el del catálogo.

## Cierre

- [x] `npx tsc --noEmit`
- [x] `npm run build`
- [ ] Probado a mano en `:3003`
- [ ] **Probado con los dos roles**: que el `editor` no vea saldos ni botones de
      plata, y —sobre todo— que **invocando la action directamente tampoco pueda**.
      No alcanza con que el botón no se muestre.
- [ ] PR mergeado a `main`
- [ ] `./scripts/worktree.ps1 borrar clientes -borrarRama`

## Review

**Qué quedó andando.** Las dos tablas, la sección Clientes completa (listado con
buscador y filtros, alta, ficha, archivar) y la cuenta corriente entera: cargo,
pago —con o sin aplicar a la otra moneda—, conversión, ajuste y anulación.

**Tres desvíos respecto del plan, y por qué.**

1. **Sin enum `moneda`.** El plan lo pedía; al escribirlo se vio que ninguna
   columna lo usaba, y encima chocaba con el `moneda` del catálogo, que sí lo
   usa. Detalle completo en la Tarea 1.

2. **Una sola action de movimientos en vez de cuatro.** El plan listaba
   `registrarCargoAction`, `registrarPagoAction`, etc. Terminó siendo
   `registrarMovimientoAction` con un `tipo` adentro: la autorización, la fecha,
   los importes y el `revalidate` eran idénticos en las cuatro, y el formulario
   —que es uno solo, con los campos que cambian según el tipo— necesita un único
   `useActionState`. La anulación sí quedó aparte, porque no comparte nada.

3. **`lib/cuenta-corriente.ts` se partió en dos.** Las reglas quedaron ahí, sin
   tocar la base, y la consulta agregada se fue a `lib/db/cuenta.ts` — el mismo
   corte que ya existía entre `lib/auth/permissions.ts` y `session.ts`. El
   disparador fue concreto: las funciones que ponen los signos y convierten
   estaban dentro de un archivo `"use server"`, que sólo puede exportar funciones
   async, y por lo tanto no había forma de ejercitar la aritmética de la plata.

**Qué se verificó, y cómo.**

- `npx tsc --noEmit` y `npm run build`, en verde.
- `npm run prueba:cuenta` — 26 comprobaciones sobre la aritmética: el caso del
  contexto entero, la anulación, la conversión en las dos direcciones, el
  redondeo al centavo, el límite y el parseo de importes tipeados a mano.
  **Agregado fuera del plan**, en `scripts/prueba-cuenta.ts`.
- Sembrando el caso del contexto en la base y leyendo la pantalla: la ficha dice
  **debe $2.600.000 · a favor USD 2.000**, el extracto muestra las dos patas del
  pago agrupadas con su TC 1.200, y el listado filtrado por deuda lo trae.
- El aviso de límite: con deuda de $2.600.000 y tope de $2.000.000 dice "Se pasó
  del límite por $600.000"; con tope de $3.000.000 no aparece.
- Los dos roles, con sesión real: el `editor` no ve saldos, ni el filtro por
  deuda, ni el límite, ni el saldo inicial, ni el formulario de movimientos.
- Que Drizzle escriba y lea bien los tipos nuevos: los importes vuelven como
  `number` y la cotización como `string`, sin pasar por un float.

**Lo que NO se verificó, y hay que hacer a mano.** El envío de los formularios
desde el navegador. Las Server Actions de React se invocan con un encoding
propio que no se reproduce con `curl` sin reimplementar el runtime, así que
**queda pendiente cargar un movimiento y anularlo haciendo clic**. Lo que sí se
comprobó estáticamente es que los 14 campos de los formularios coinciden uno a
uno con lo que leen las actions.

**`main` se movió a mitad de camino** — entró el CMS de contenido — así que la
rama se rebasó encima. Los siete conflictos eran todos aditivos (los dos lados
sumaban algo a `schema.ts`, a `permissions.ts`, al nav) salvo el de las
migraciones, que se resolvió como estaba previsto: el CMS se quedó con el
`0002`, esta rama regeneró el suyo como `0003`. Recién después se tocaron los
docs, para no pelear con un archivo que `main` acababa de reescribir.

**Lo que salió de la pasada de prolijidad, antes de mergear.**

- Se borró `canManageClientes`, que siempre devolvía `true` (ver Tarea 2).
- Se reusa el `form-ui.tsx` que extrajo el catálogo, en vez de tener copias
  propias de `Aviso` y `Submit`.
- **El extracto ya no agrupa por adyacencia.** Las dos patas de un pago
  aplicado se escriben en el mismo `INSERT` y comparten `fecha` y `created_at`
  **exactos**, así que el `ORDER BY` no decide nada entre ellas: agruparlas
  porque venían pegadas funcionaba de casualidad. Ahora lo hace
  `conOperacionesJuntas()`, que además pone la conversión después de lo que la
  originó.
- Clientes aparece en el inicio del panel, como las demás secciones, con el
  conteo de activos y —sólo para admin— cuántos deben.
- Se corrigió la codificación de `scripts/prueba-cuenta.ts`, que se había roto
  al moverlo con PowerShell (los guiones largos quedaron como `â€"`).

**Queda plata formateada en dos lugares, y hay que unificarlo.** El ABM de
catálogo entró con `lib/precio.ts` (`formatearPrecio`, `aCentavos`), que se
superpone con `formatARS` / `formatUSD` / `importeACentavos` de esta iteración.
No se unificó acá a propósito —es código recién mergeado y mezclarlo hacía
ilegible la revisión— pero conviene hacerlo pronto, porque las diferencias no
son cosméticas:

- **`formatearPrecio` pierde el signo de los negativos.** `formatearPrecio(-50,
  "ARS")` devuelve `"$0,50"`, y `-150000` devuelve `"$-1.500"` en vez de
  `"-$1.500"`. La causa es `Math.trunc(centavos / 100)`, que para `-50` da `-0`.
  Hoy no molesta —un precio de lista nunca es negativo— pero rompe apenas se
  muestre un descuento o una nota de crédito. La cuenta corriente **sí** tiene
  negativos, y por eso usa su propio formateador.
- **El prefijo del dólar no coincide**: `US$ 2.000` en catálogo, `USD 2.000` en
  la cuenta. Elegir uno es una decisión de producto.
- **Los parsers son distintos a propósito**: el de catálogo está detrás de un
  `input type="number"` y sólo acepta `1234.56`; el de la cuenta entiende lo que
  se tipea desde un cuaderno (`5.000.000`, `$ 2.000`). Al unificar hay que
  quedarse con el permisivo, no con el estricto.

**Las tablas quedan vacías**: al regenerar la migración hubo que borrar lo que
había creado el `0002` descartado, y con eso se fue el cliente de prueba. Mejor
así — el primer cliente lo crea el click-through.
