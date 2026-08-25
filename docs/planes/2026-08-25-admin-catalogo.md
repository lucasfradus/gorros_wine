# Catálogo en la base: CRUD de Bodegas y Productos — Plan

> **Para quien lo ejecute**: este plan es autocontenido. Todo el contexto
> necesario está acá; no hace falta releer la conversación donde se decidió.
> Antes de tocar código, leer `AGENTS.md` y `tasks/lessons.md`.
> Los pasos van con checkbox (`- [ ]`) y se marcan a medida que avanzan.

**Objetivo:** desde `/admin` se pueden dar de alta, editar y archivar bodegas y
productos —con precio en ARS o USD, cotización del dólar y stock— y todo eso
queda en la base.

**Enfoque:** dos tablas nuevas (`bodegas`, `productos`) más una de historial de
cotización, con el mismo molde que ya usa Usuarios: `actions.ts` con
autorizar → validar → reglas → escribir → revalidar, páginas que también
autorizan, y los estilos del `admin.module.css` que ya existe.

**Las fotos quedan afuera** (decisión 4): la subida la resuelve entera
`feat/cms-contenido`. Acá se dejan las columnas `logo_key` e `imagen_key`
listas y el campo se enchufa después.

> **Al cerrar**: esa rama ya mergeó a `main` (PR #2), esta rama se rebasó
> encima, y enchufar el campo de imagen quedó como el próximo PR.

**Worktree:** `../Gorros-admin-catalogo` · rama `feat/admin-catalogo` · puerto `:3002`

---

## Contexto

Hoy el catálogo de la tienda es un array de TypeScript en
[lib/data.ts](../../lib/data.ts): nueve vinos escritos a mano. La base sólo tiene
`users` y `sessions`, y el inicio del panel lo dice con todas las letras
("todavía escritas a mano en `lib/data.ts`"). Para poder cargar etiquetas sin
tocar código, primero tiene que existir el modelo y su ABM.

Esta iteración hace **sólo el panel**. La tienda pública sigue leyendo
`lib/data.ts` hasta la iteración siguiente; se decidió partir en dos porque
migrar el render público cambia `/catalogo`, `/producto/[id]`, `/buscar` y la
home, y saca esas páginas del render estático.

## Mapa del código actual

| Qué | Dónde |
| --- | --- |
| Schema y tipos | [lib/db/schema.ts](../../lib/db/schema.ts) |
| Sesión y guards (`requireUser`) | [lib/auth/index.ts](../../lib/auth/index.ts) |
| Permisos por rol | [lib/auth/permissions.ts](../../lib/auth/permissions.ts) |
| Molde de CRUD a copiar | [app/(admin)/admin/(panel)/usuarios/](<../../app/(admin)/admin/(panel)/usuarios/>) |
| Estilos del panel (ya tiene todo) | [app/(admin)/admin/admin.module.css](<../../app/(admin)/admin/admin.module.css>) |
| Navegación lateral | [app/(admin)/admin/(panel)/nav-links.tsx](<../../app/(admin)/admin/(panel)/nav-links.tsx>) |
| Campos que la tienda ya renderiza | [lib/data.ts](../../lib/data.ts), [components/catalog-view.tsx](../../components/catalog-view.tsx) |
| Receta general del módulo | [docs/COMO-AGREGAR-MODULO.md](../COMO-AGREGAR-MODULO.md) |

## Decisiones ya tomadas (NO volver a preguntar)

1. **Alcance: sólo el panel.** La tienda no se toca en esta iteración.
2. **Precios en ARS y USD**, con una cotización cargable desde el panel para
   poder mostrar el equivalente en pesos.
3. **Stock como número de botellas**, no un booleano.
4. **La subida de imágenes NO se construye acá.** La resuelve entera
   `feat/cms-contenido`, que ya tiene sin commitear `lib/content/bucket.ts`
   (firma SigV4 con `aws4fetch`), `app/media/[...key]/route.ts`,
   `image-field.tsx`, el `bodySizeLimit` de `next.config.mjs` y las variables
   `S3_*`. Escribir una segunda copia acá serían dos clientes de bucket y dos
   rutas de imagen para unificar en el merge. Se espera esa rama y después se
   enchufa — ver *Pendiente*, más abajo.
5. **Las columnas de imagen igual van desde ahora**, y guardan la **key**, no
   un id. Es la misma forma que usa el CMS: `media` es el registro de lo subido
   y la allowlist del proxy, pero quien consume la imagen guarda la key
   desnormalizada. Así el schema no se rehace después.
6. **Sin permisos nuevos.** `ROLE_DESCRIPTION` ya dice que el editor maneja
   "catálogo, precios y eventos": admin y editor pueden todo acá. Alcanza con
   `requireUser()`; no se agrega ninguna función a `permissions.ts`.
7. **Se archiva, no se borra** (`isActive`), igual que los usuarios y por la
   misma razón: mañana hay pedidos colgando de un producto.
8. **La plata en centavos, en `integer`.** Nunca float. Techo del tipo:
   $21.474.836,47 por botella — sobra.

## Lo que la tienda ya renderiza y por eso está en el modelo

No son campos inventados: si no están, la ficha actual no se puede reproducir.

| Campo | Dónde se ve hoy |
| --- | --- |
| `tipo` | filtro principal del catálogo y miga de pan de la ficha |
| `region` | card del catálogo, ficha, y búsqueda en `/buscar` |
| `guarda` | fila "Guarda" de la tabla de specs |
| `maridajes` | bloque "Maridajes sugeridos" de la ficha |
| `descripcion` | hoy las 9 etiquetas comparten `placeholderDescription` |
| `destacado` | la home hace `wines.slice(0, 4)` |
| `imagenKey` | los huecos `[ botella ]` de la card y la galería |

## Fuera de alcance

- **Subir imágenes desde el panel** y crear el bucket de Railway: los trae
  `feat/cms-contenido`. Acá quedan las columnas y nada más.
- Migrar la tienda pública a la base, y migrar los 9 vinos de `lib/data.ts`.
- Importación desde planilla (la promete el inicio del panel; va después).
- Galería de varias fotos por producto: una imagen por producto en esta vuelta.
- SKU / código interno: se agrega con una migración de una línea si hace falta.
- Pedidos, clientes y carrito con persistencia.

## Pendiente: enchufar las fotos

Un PR chico. `feat/cms-contenido` ya está en `main`, así que está desbloqueado:

- En `bodega-forms.tsx` y `producto-forms.tsx`, sumar el campo de imagen
  reusando su `image-field.tsx` y su `uploadMediaAction`.
- Mostrar la miniatura en los dos listados, apuntando a `/media/<key>`.
- No hace falta migración: `logo_key` e `imagen_key` ya existen.

---

## Archivos

- **Crear** `lib/catalogo.ts` — constantes del dominio (tipos de vino,
  varietales sugeridos, monedas, etiquetas) y `slugify`. Van juntas porque las
  usan el formulario, la validación y, más adelante, los filtros de la tienda.
- **Crear** `lib/precio.ts` — formateo y conversión USD→ARS. Aparte de
  `lib/format.ts`, que es sólo fechas.
- **Crear** `app/(admin)/admin/(panel)/bodegas/{page,nuevo/page,[id]/page}.tsx`,
  `actions.ts`, `bodega-forms.tsx`.
- **Crear** `app/(admin)/admin/(panel)/productos/{page,nuevo/page,[id]/page}.tsx`,
  `actions.ts`, `producto-forms.tsx`.
- **Modificar** `lib/db/schema.ts` — enums y las tres tablas nuevas.
- **Modificar** `app/(admin)/admin/(panel)/nav-links.tsx` — sección "Catálogo".
- **Modificar** `app/(admin)/admin/(panel)/page.tsx` — reemplazar el cartel de
  "escritas a mano" por el conteo real.
- **Modificar** `app/(admin)/admin/admin.module.css` — sólo lo que falte
  (chips de varietales, celda de precio). Reusar `.card`, `.table`, `.form`,
  `.field`, `.input`, `.select`, `.badge`, `.btn*` antes de escribir nada nuevo.

---

## Tarea 1: Worktree — hecha

- [x] `./scripts/worktree.ps1 nuevo admin-catalogo`, puerto `:3002`.
- [x] Bucket y credenciales: **sacados de esta iteración**. Los trae
      `feat/cms-contenido` (decisión 4). No se instala ningún SDK de S3 acá.

## Tarea 2: Schema y migración — hecha

**Archivos:** modificar `lib/db/schema.ts`

- [x] Enums: `tipoVino` (`Tinto`, `Blanco`, `Espumante`, `Rosado` — los cuatro
      que la tienda ya usa) y `moneda` (`ARS`, `USD`).
- [x] Tabla `bodegas`: `id`, `slug` (unique), `nombre` (unique), `logoKey`,
      `pais`, `sitioWeb`, `contactoNombre`, `contactoEmail`,
      `contactoTelefono`, `notas`, `isActive`, `createdAt`, `updatedAt`.
      El contacto va en tres columnas y no en un campo libre: así se puede armar
      el `mailto:` y el link de WhatsApp.
- [x] Tabla `productos`: `id`, `slug` (unique), `nombre`, `bodegaId` →
      `bodegas.id` con **`onDelete: "restrict"`**, `tipo`, `varietales` `text[]`,
      `region`, `anada` (integer **nullable**: hay espumantes y blends sin
      añada), `precioCentavos`, `moneda`, `stock`, `isActive`, `destacado`,
      `descripcion`, `guarda`, `maridajes` `text[]`, `volumenMl` (default 750),
      `imagenKey`, `createdAt`, `updatedAt`.
      Índices: `bodegaId` e `isActive`.
- [x] Tabla `cotizaciones`: `id`, `arsPorUsdCentavos`, `createdAt`, `createdBy`
      → `users.id`. Es **historial**, no una fila que se pisa: leer la última es
      un `orderBy(desc(...)).limit(1)`, no hay upsert que escribir, y queda
      registrado quién cambió el dólar y cuándo.
- [x] Tipos `$inferSelect` / `$inferInsert` de las tres, al final del archivo.
- [x] `npm run db:generate` y el SQL commiteado (ver Migraciones, más abajo).
- [x] **Verificado**: `npx tsc --noEmit` en verde, `npm run db:migrate` aplicado
      y las tres tablas comprobadas con `psql` en `gorros-db`.

## Tarea 3: Dominio y precios

**Archivos:** crear `lib/catalogo.ts`, `lib/precio.ts`

- [x] `lib/catalogo.ts`: `TIPOS`, `VARIETALES` (lista curada — se elige de una
      lista y no se tipea libre, o en tres meses hay "Malbec", "malbec" y
      "MALBEC"), `MONEDA_LABEL`, y `slugify(nombre)`.
- [x] `lib/precio.ts`: `formatearPrecio(centavos, moneda)` y
      `aPesos(centavos, moneda, cotizacion)`. Reusar el criterio de
      `formatPrice` de `lib/data.ts`: separador de miles a mano, sin `Intl`,
      para que servidor y cliente coincidan al hidratar.
- [x] **Verificar**: `npx tsc --noEmit`.

## Tarea 4: Servir las imágenes — fuera de alcance

La resuelve `feat/cms-contenido` con `app/media/[...key]/route.ts`. Cuando
mergee, las fotos del catálogo salen por esa misma ruta sin tocar nada acá.

## Tarea 5: CRUD de Bodegas

**Archivos:** crear los cinco de `bodegas/`

- [x] `actions.ts` con `crear`, `editar`, `archivar/reactivar`, en el orden de
      siempre: **autorizar (`requireUser()`) → validar (zod) → reglas → escribir
      → `revalidatePath`**. La autorización va también acá, no sólo en la
      página: una Server Action es un endpoint HTTP.
- [x] Regla: al archivar, avisar cuántos productos activos cuelgan. **Borrar no
      existe** — la FK es `restrict` y el formulario no ofrece la opción.
- [x] Listado con nombre, contacto y cantidad de productos.
- [x] Mensajes de error para quien los lee: "Ya hay una bodega con ese nombre",
      no el texto del constraint.
- [x] **Verificar**: alta, edición y archivado; y que archivar una bodega con
      productos activos avise en vez de hacerlo en silencio.

## Tarea 6: CRUD de Productos

**Archivos:** crear los cinco de `productos/`

- [x] `actions.ts` igual que bodegas. El `slug` sale de `slugify(nombre)` y es
      editable; si choca, el error lo dice.
- [x] Formulario con `useActionState` (React 19), bodega como `<select>`,
      varietales y maridajes como multi-selección, precio + moneda juntos.
- [x] Con moneda USD, el formulario muestra el equivalente en pesos a la
      cotización vigente. Si no hay ninguna cargada, lo dice en vez de mostrar
      un número inventado.
- [x] Listado con nombre, bodega, tipo, precio, stock y estado. Badge cuando
      `stock === 0`.
- [x] Filtro por bodega y por tipo, y búsqueda por nombre — con 200 etiquetas
      una tabla plana no se usa.
- [x] **Verificar**: alta completa, edición y archivado, con el precio en USD
      mostrando su equivalente en pesos.

## Tarea 7: Cotización

**Archivos:** modificar `productos/page.tsx` y `productos/actions.ts`

- [x] Card arriba del listado: "US$ 1 = $X · actualizado el …" con un formulario
      chico que inserta una fila nueva en `cotizaciones`. Sin página propia:
      es un dato, no una sección.
- [x] **Verificar**: cambiar la cotización y ver que los precios en USD del
      listado se recalculan.

## Tarea 8: Navegación e inicio

**Archivos:** modificar `nav-links.tsx` y `(panel)/page.tsx`

- [x] Sección "Catálogo" con Productos y Bodegas, visible para los dos roles.
- [x] Reemplazar el cartel de "todavía escritas a mano en `lib/data.ts`" por el
      conteo real de productos y bodegas, aclarando que la tienda pública
      todavía no los usa. Sin métricas inventadas, como ya avisa el comentario
      de ese archivo.

---

## Tarea 9: Categorías — hecha

**Ampliación pedida el 2026-08-25**, después de tener andando lo anterior: la
vinoteca no vende sólo vino, también accesorios, heladeras y regalería. Todo lo
construido hasta acá era, en realidad, **la ficha de un vino**.

Decisiones tomadas con el usuario, y que no se vuelven a discutir:

- **Una sola tabla `productos`** con los campos de vino en nullable, y la
  categoría decidiendo cuáles se piden. Se descartó una tabla `vinos` 1:1
  porque metía un join en todas las lecturas del catálogo.
- **`bodega_id` pasa a nullable**, sin inventar un campo `marca` ni renombrar
  bodegas a proveedores. Una copa simplemente no tiene bodega.
- **Categorías con subcategorías**, dos niveles.

- [x] Tabla `categorias`: `slug`, `nombre`, `parentId` (auto-FK, `restrict`),
      `orden`, `esVino`, `isActive`. `esVino` se hereda del padre **al guardar**
      y no se calcula al leer, así ninguna consulta sube por el árbol.
- [x] ABM completo, con el listado como árbol y las reglas en `validarPadre()`:
      no ser su propio padre, no un tercer nivel, y una categoría con hijas no
      puede volverse hija (con eso, garantizar que no haya ciclos es trivial).
- [x] **Verificado**: subcategoría creada; el intento de tercer nivel devuelve
      *"Prueba Copas" ya es una subcategoría, y no se admite un tercer nivel*.

## Tarea 10: Varietales — hecha

- [x] Tabla `varietales` + intermedia `producto_varietales`, en lugar del
      `text[]` contra una lista fija en código.
- [x] ABM con el alta en el propio listado: agregar un varietal es escribir una
      palabra, y mandar a otra pantalla para eso es fricción sin contrapartida.
- [x] **Verificado**: renombrar "Merlot" lo cambió en los dos vinos que lo
      usaban, sin tocar ningún producto. Es justamente para eso que existe.

## Tarea 11: Productos según la categoría — hecha

- [x] `armarFila()` concentra la regla: valida el esquema base, mira la
      categoría y sólo entonces pide (o descarta) los campos de vino.
- [x] El formulario **no renderiza** los campos de vino cuando la categoría no
      los lleva, en vez de deshabilitarlos.
- [x] El listado pasó a `leftJoin` con bodegas: con `innerJoin`, los accesorios
      —que no tienen bodega— habrían desaparecido de la tabla.
- [x] **Verificado**: un accesorio guarda todos los campos de vino en NULL; un
      POST armado a mano que los manda igual los descarta; un vino sin uvas se
      rechaza; y las uvas quedan en la tabla intermedia.

---

## Migraciones

- [x] **Una sola migración: `0003_true_spacker_dave.sql`**, aditiva. Crea
      `categorias`, `varietales`, `bodegas`, `productos`, `producto_varietales`
      y `cotizaciones`. No toca `users`, `sessions`, `content` ni `media`.
- [x] Lleva **dos INSERT agregados a mano**: las cuatro categorías y los
      veintiún varietales semilla. El primero no es una comodidad —
      `productos.categoria_id` es NOT NULL, así que con `categorias` vacía no se
      puede cargar ni un producto—; el segundo evita que cargar el primer vino
      exija tipear antes veinte uvas.
- [x] **Verificada contra una base virgen** (contenedor aparte en `:5442`),
      corriendo la cadena entera `0000 → 0003` como la va a correr producción:
      10 tablas, 4 categorías y 21 varietales.

> **Durante el desarrollo fueron tres migraciones y terminaron siendo una.** Al
> rebasar sobre `main` apareció que el CMS ya había tomado el número `0002`, así
> que se regeneraron desde cero sobre el schema ya mezclado. Salió mejor: las
> tres originales incluían un paso de `text[]` a tabla intermedia y un
> `nullable → backfill → NOT NULL` que sólo hacían falta porque las tablas ya
> existían en la base de desarrollo. Contra una base donde no existen, todo eso
> sobra.
>
> De paso, dos cosas que conviene recordar de `drizzle-kit generate`: **pide un
> prompt interactivo** si en el mismo diff se agrega una columna y se borra otra
> (no sabe si es un renombre, y sin TTY aborta), y **no sabe nada de datos**: si
> una columna nueva es NOT NULL sobre una tabla con filas, el SQL que genera
> falla y hay que editarlo.

## Cierre

- [x] `npx tsc --noEmit`
- [x] `npm run build`
- [x] Probado a mano en `:3002`
- [x] Probado con **los dos roles**: que el editor pueda entrar a Catálogo y
      que Usuarios le siga estando vedada — y no sólo que no vea el botón
- [x] `docs/ARQUITECTURA.md` actualizado: la sección "De dónde salen los datos"
      dice que la base sólo tiene `users` y `sessions`, y deja de ser cierto
- [x] `docs/COMO-AGREGAR-MODULO.md` revisado: usa `productos` como ejemplo
      inventado y ahora existe de verdad
- [ ] PR mergeado a `main`
- [ ] `./scripts/worktree.ps1 borrar admin-catalogo -borrarRama`

## Review

**Qué se hizo.** Las tres tablas con su migración (`0002_stormy_beyonder.sql`,
aditiva), el ABM completo de Bodegas y Productos, la cotización del dólar como
historial, y la sección Catálogo en la navegación. El inicio del panel dejó de
decir que el catálogo está escrito a mano y ahora cuenta lo que hay en la base,
aclarando que la tienda todavía no lo lee.

**Qué cambió respecto del plan, y por qué.**

1. **Las fotos salieron de alcance.** A mitad de la Tarea 2 apareció que
   `feat/cms-contenido` ya tenía resuelta —sin commitear— toda la
   infraestructura de imágenes: cliente del bucket con `aws4fetch`, ruta
   `/media/[...key]`, campo de subida, `bodySizeLimit` y variables `S3_*`.
   Construir una segunda copia habría dejado dos clientes de bucket y dos rutas
   que unificar en el merge. Se replanificó con el usuario: quedan las columnas,
   se enchufa después. Además el bucket todavía no existe y Railway está
   deslogueado, así que ni siquiera se podía probar.
2. **Se extrajo `form-ui.tsx`.** `Aviso` y `Submit` estaban en
   `user-forms.tsx`; copiarlos a Bodegas y a Productos habría dejado tres
   versiones del mismo botón. Se movieron a
   `app/(admin)/admin/(panel)/form-ui.tsx` y Usuarios ahora los importa de ahí.
3. **Se extrajo `lib/campos.ts`.** Los fragmentos de zod compartidos no podían
   vivir en un `actions.ts`: un archivo `"use server"` sólo exporta funciones
   asíncronas.
4. **De paso, dos correcciones en documentos** que ya estaban desactualizados y
   que este plan tocaba igual: la tabla de roles de `ARQUITECTURA.md` seguía
   listando `owner`, y `COMO-AGREGAR-MODULO.md` recomendaba inventar
   `canEditCatalog`/`canEditPrices`, que es justo lo contrario de lo que se
   decidió acá.

**Cómo se verificó.** `npx tsc --noEmit` y `npm run build` en verde. Con datos
sembrados y una sesión real en `:3002`: las tres pantallas renderizan, la
conversión USD→ARS da bien (US$ 32,50 con el dólar a $1.650,50 ⇒ $53.641,25) y
se recalcula sola al cambiar la cotización. Las Server Actions se ejercitaron por
el camino sin JavaScript (POST multipart con el `$ACTION_ID` del formulario):
alta de bodega y de producto OK; nombre repetido, mail inválido, varietal fuera
de lista y producto sin varietal devuelven el mensaje correcto y **no escriben**;
un POST sin sesión redirige a `/admin/login` sin tocar la base.

**Segunda vuelta (mismo día).** El usuario marcó que el catálogo no es sólo
vino y pidió ABM de categorías y de varietales. Eso reencuadró lo anterior: era
la ficha de un vino, no la de un producto. Salieron las tareas 9, 10 y 11.

**Qué quedó pendiente.**

- El campo de imagen. **`feat/cms-contenido` ya mergeó a `main`** (PR #2, commit
  `4e64455`), así que dejó de estar bloqueado: hay que rebasar esta rama sobre
  `origin/main` y enchufar su `image-field.tsx`. Ojo, el rebase toca
  `nav-links.tsx`, `(panel)/page.tsx`, `lib/db/schema.ts`, `next.config.mjs`,
  `package.json` y los dos documentos de `docs/` — conflictos chicos pero varios.
- Cablear la tienda pública a la base: es la iteración que sigue.
- En la base compartida quedaron filas de prueba con prefijo `Prueba `. Se
  limpian con `delete from productos where nombre like 'Prueba %'` y lo mismo
  para `bodegas`.
- `nav-links.tsx` y `(panel)/page.tsx` los toca también `feat/cms-contenido`:
  ahí va a haber conflicto de merge, chico y de una sola dirección.
