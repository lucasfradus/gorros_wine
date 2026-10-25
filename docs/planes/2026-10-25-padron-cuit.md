# Datos del receptor desde el padrón de ARCA — Plan

> **Para quien lo ejecute**: este plan es autocontenido. Antes de tocar código,
> leer `AGENTS.md` y `tasks/lessons.md`.

**Objetivo:** al tipear un CUIT en la factura (o en el alta de un cliente), que
se completen solos razón social, condición frente al IVA, domicilio, localidad
y provincia, como en "Comprobantes en línea" de ARCA.

**Enfoque:** Facturante ya consulta el padrón de ARCA. Una Server Action lo
llama desde el servidor con el usuario de siempre, y el formulario completa los
campos, que quedan editables.

**Worktree:** `../Gorros-factura-manual` (reusado) · rama `feat/padron-cuit` · puerto `:3003`

---

## Lo que ya se probó (2026-10-25)

- `POST /User/VerifyCuit` `{ Cuit }` **responde con el token de empresa** (el de
  `lib/facturante/client.ts`), en el sandbox y en producción.
- En **producción** devuelve `businessName`, `taxTreatmentId` (1 RI · 3 exento ·
  4 CF · 5 monotributo), `fiscalAddress` (una cadena, puede traer entidades HTML
  y basura como un " 0" final), `stateId`, `cityId`, `postalCode` y
  `foundInPadron`. En el **sandbox** no trae domicilio (vienen en null).
- `stateId` es el id de Facturante: 1 CABA, 2 Buenos Aires… 13 Mendoza; el mismo
  orden que `PROVINCIAS`. Verificado con `GET /State`.
- `GET /State/{id}/City` responde con el token de empresa y trae
  `{ id, name, state: { code }, zipCodes }`. Buenos Aires tiene 2931 ciudades:
  se cachea en memoria por provincia.
- `POST /Public/InfoCuit/GetPerson` (de la doc) da 404 en el sandbox: no se usa.
- Clicnet ya resolvió el parseo (`decodificarEntidades`, `parsearCalle`): se
  porta lo necesario.

## Decisiones

1. Se consulta **sólo con un CUIT válido** (11 dígitos y verificador) y **sólo
   si no es de un cliente** ya cargado: en ese caso manda la ficha del cliente.
2. Se completan razón social, condición IVA, calle, localidad y provincia, y se
   avisa "Datos del padrón de ARCA". Todo queda editable y pasa por la vista
   previa.
3. Si no está en el padrón o Facturante no responde, se avisa y se carga a mano.
4. Caché en memoria del servidor (CUIT 1 h, ciudades 24 h): evita repetir la
   consulta mientras se edita la factura. La persistencia es el cliente que se
   guarda.
5. Vale para la factura manual, la de un cobro (comparten el receptor) y el alta
   o edición de un cliente.

## Tareas

- [x] **1. Cliente HTTP y parseo** — `consultarCuit()` y `ciudadesDe()` en
      `lib/facturante/client.ts`; `lib/facturante/padron.ts` (puro): id de
      provincia → código, condición IVA, limpieza de la calle. Chequeos offline.
- [x] **2. Server Action** `buscarEnPadronAction(cuit)` en facturación, con
      `requireFacturacion()` (y la de clientes con `requireUser()`), caché.
- [x] **3. Receptor** — al completar un CUIT válido que no es de un cliente,
      busca y completa; estado "Buscando en el padrón…" con spinner.
- [x] **4. Alta/edición de cliente** — botón "Completar desde ARCA" junto al CUIT.
- [x] **5. Docs** — `docs/ARQUITECTURA.md`.

## Cierre

- [x] tsc, prueba offline, build
- [x] Sandbox: un CUIT no encontrado y uno encontrado (sin domicilio)
- [x] Producción, solo lectura: los dos CUIT conocidos, con domicilio
- [ ] PR (merge con confirmación)

## Review

Hecho como se planeó. Probado:

- **Sandbox, en el navegador**: el CUIT de Valentin Bianchi completa razón social y
  Responsable Inscripto (Factura A) y avisa "vino sin domicilio"; el de LINKSIDE
  avisa que no está en el padrón; "Completar desde ARCA" en el alta de cliente
  trae a AUTONORT S A.
- **Producción, sólo lectura** (la misma `buscarCuit`): Valentin Bianchi →
  COMANDANTE TORRES 500, SAN RAFAEL, Mendoza, 5600; Autonort → ACCESO N/RAMAL
  PILAR KM 51200, PILAR, Buenos Aires, 1629. El " 0" final se limpia.
- La tabla de ciudades del sandbox no coincide con la de producción (16708 es
  "Capitán Montoya" en una y "San Rafael" en la otra): vale la de producción.

Monotributo: se completa y se avisa que todavía no se le factura desde acá
(`letraPara` lo bloquea hasta verificar su código).
