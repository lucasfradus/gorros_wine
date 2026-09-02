# Arquitectura

Sitio de la vinoteca **Gorros Wine** (Pilar, Buenos Aires): la tienda pública más
un panel de administración.

## Stack

| Pieza | Qué se usa |
| --- | --- |
| Framework | Next.js 15 — App Router, Server Components, Server Actions |
| Base de datos | PostgreSQL 17 + Drizzle ORM (`drizzle-kit` para migraciones) |
| Estilos | CSS Modules + tokens en `app/globals.css`. Sin framework de CSS |
| Tipografías | `next/font/google` (Fraunces + Jost), autoalojadas en el build |
| Autenticación | Propia: sesiones en base, cookie `gw_session`, bcrypt |
| Validación | zod v4 |
| Contenido | CMS propio: tabla clave/valor + registro tipado en `lib/content/` |
| Imágenes | Bucket S3 de Railway (privado), servidas por `/media/[...key]` |

Sin Prisma, sin NextAuth, sin Tailwind. Ver `AGENTS.md` antes de escribir código.

## Las dos mitades del sitio

Los grupos de rutas no aparecen en la URL; existen para darle a cada mitad su
propio layout.

```
app/
├── (store)/              público — fondo negro, nav, footer, age gate
│   ├── page.tsx          home
│   ├── catalogo/         grilla con filtros (?tipo=)
│   ├── producto/[id]/    ficha, SSG
│   ├── buscar/           por nombre, bodega, uva o región
│   ├── carrito/          pedido y subtotal
│   ├── club/  eventos/  nosotros/  cuenta/
│   └── terminos/  privacidad/
│
├── media/[...key]/       sirve desde el bucket toda imagen subida al panel
│
└── (admin)/              panel — su propio layout, sin nav de tienda
    └── admin/
        ├── login/        pantalla de ingreso
        └── (panel)/      todo lo que exige sesión
            ├── page.tsx  inicio del panel
            ├── clientes/ agenda del negocio y cuenta corriente
            ├── productos/ ABM del catálogo + cotización del dólar
            ├── categorias/ qué clase de cosa es cada producto (con árbol)
            ├── bodegas/  ABM de proveedores y su contacto comercial
            ├── varietales/ las uvas que se pueden elegir en un vino
            ├── contenido/ textos e imágenes del sitio
            ├── usuarios/ alta, edición, roles, activar/desactivar
            └── cuenta/   mi perfil y cambio de contraseña
```

Las rutas de venta —`catalogo/`, `producto/[id]/`, `buscar/`, `carrito/` y
`cuenta/`— están **apagadas**: responden 404. El porqué, abajo.

## De dónde salen los datos

Hoy conviven tres fuentes, y conviene tenerlo claro:

- **El catálogo que muestra la tienda vive en `lib/data.ts`**, como arrays de
  TypeScript. Es la razón por la que `/catalogo` y las fichas se pueden generar
  estáticas.
- **Los textos y las fotos del sitio salen del CMS** (ver abajo).
- **El catálogo editable vive en la base**: además de `users`, `sessions`,
  `content` y `media` están `categorias`, `varietales`, `bodegas`, `productos`,
  `producto_varietales` y `cotizaciones` (`lib/db/schema.ts`), que se editan
  desde la sección Catálogo del panel.
- **Los eventos también viven en la base** (`eventos`), y a diferencia del
  catálogo **la tienda ya los lee**: ver la sección de abajo.
- **Los clientes y su cuenta corriente también**: `clientes` y `movimientos_cc`
  (ver más abajo).

O sea que **el catálogo que se carga en el panel todavía no se ve en la
tienda**. Fue a propósito: mover el render público a la base cambia
`/catalogo`, `/producto/[id]`, `/buscar` y la home, y las saca del render
estático. Es la iteración que sigue, y va en worktree.

### Mientras tanto, la tienda está apagada

Lo que un visitante vería hoy es el catálogo de muestra de `lib/data.ts`:
veintiséis vinos con precios inventados. Prometer envíos y precios que no
existen es peor que no tener catálogo, así que la mitad de venta del sitio
público cuelga de una constante, en `lib/ventas.ts`:

```ts
export const VENTAS_ACTIVAS = false;
```

Con eso en `false`:

- La home pierde las etiquetas destacadas y el "cómo comprar".
- El nav pierde Catálogo, Buscar, Cuenta y Carrito; el footer, Catálogo.
- El layout de `(store)` no monta el `CartProvider`: sin quien lo consuma, no
  hay lectura de `localStorage` en ninguna página.
- `/catalogo`, `/producto/:id`, `/carrito`, `/buscar` y `/cuenta` responden 404
  (`requireVentas()`, al estilo de `requireUser()`) y salen del sitemap.
- Los botones del hero y del cierre de Nosotros, que llevaban al catálogo,
  abren el WhatsApp del local.

No se borró nada: la grilla, la ficha, el carrito y la búsqueda esperan enteras
del otro lado del flag, para enchufarse a los datos reales cuando el catálogo de
la base salga a la tienda. `robots.txt` **no** las menciona a propósito: un
`Disallow` le impediría a Google entrar, ver el 404 y sacar esas URLs del
índice.

Para volver a prenderla alcanza con poner `true`, y revisar desde el panel el
texto de los dos botones que mientras tanto dicen "Escribinos".

Los eventos son la excepción, y sirven de ensayo de ese camino: se cargan en el
panel y **la tienda ya los lee**, sin perder el prerender. Cómo, en la sección
que sigue.

Sobre el modelo del catálogo, cuatro decisiones que se explican una sola vez:

- **La categoría decide la ficha.** La vinoteca no vende sólo vino: también
  accesorios, heladeras y regalería. `categorias.esVino` dice si los productos
  de esa categoría llevan bodega, varietales, añada, guarda y maridajes. Las
  subcategorías (dos niveles, "Accesorios › Copas") lo heredan al guardarse.
- **Una sola tabla `productos`, con los campos de vino en nullable.** Se
  eligió sobre una tabla `vinos` aparte para que el listado, los filtros y la
  búsqueda no lleven joins. Como la base entonces no puede garantizar la
  coherencia, la garantiza `armarFila()` en `productos/actions.ts`: si la
  categoría no es de vino, esos campos se fuerzan a `null` en vez de guardarse
  a medias.

- **La plata va en centavos enteros**, nunca en `float`. Un producto guarda su
  precio en su moneda (`ARS` o `USD`); el equivalente en pesos **no se guarda**,
  se calcula contra la última fila de `cotizaciones` (ver `lib/precio.ts`). Si
  se guardara, cada movimiento del dólar obligaría a reescribir el catálogo.
- **`cotizaciones` es un historial**, no una fila que se pisa: la vigente es la
  última. No hay upsert que escribir y queda asentado quién movió el dólar.

## La agenda de eventos

Las catas y encuentros **sí** están en la base, desde la iteración del ABM. Se
cargan en **Eventos**, en el panel, y se leen con `lib/eventos.ts`.

Un evento es una fecha, no un rango: de `comienza` salen el día, el mes y la
hora que muestra la tarjeta. La tienda lista los próximos con botón de reserva
y, debajo, los seis últimos que ya pasaron, apagados y sin botón. El panel no
tiene ese tope, que es donde el histórico completo se viene a buscar.

Tres cosas que no son obvias:

- **La lectura va cacheada con el tag `eventos`, y además con un techo de
  quince minutos.** El tag cubre las ediciones del panel; el techo cubre el
  paso del tiempo, porque la agenda cambia **sola** —un evento pasa de próximo
  a pasado sin que nadie toque nada— y sin él una cata ya empezada seguiría
  anunciándose como próxima hasta la siguiente edición.
- **`unstable_cache` serializa a JSON: las `Date` vuelven como string.** Por eso
  `lib/eventos.ts` declara la frontera de forma explícita: lo que se cachea
  lleva `comienza` como ISO, y `getAgenda` es el único lugar que la reconvierte.
  Sin eso, la primera lectura funciona —caché frío, objeto tal cual salió de
  Drizzle— y la segunda rompe.
- **La hora se guarda y se lee siempre en la zona de Buenos Aires**, fija en
  `lib/format.ts`. El formulario usa `<input type="datetime-local">`, que
  entrega un string sin zona, y producción corre en UTC.

Los textos que rodean a la agenda —volanta, título, bajada, galería, el aviso
de "no hay fechas"— siguen siendo del CMS.

## Clientes y cuenta corriente

Los **clientes** son los del negocio y no los `users` del panel: un cliente
compra vino y debe plata, un user entra al admin.

Dos decisiones explican todo lo demás.

**El saldo no es una columna: es la suma de los movimientos.** Un saldo guardado
es la forma clásica de que la cuenta y el historial dejen de coincidir sin que
nadie sepa cuál de los dos miente. De ahí sale gratis la corrección de errores:
anular es agregar la operación inversa, el par se cancela solo al sumar, y el
extracto de hace tres meses sigue diciendo lo que decía. Por eso acá **no hay
`UPDATE` ni `DELETE`** sobre un movimiento.

**La moneda es del movimiento, no del cliente.** Cada cliente tiene dos saldos
que conviven —pesos y dólares— y el dólar no se pesifica solo: se pesifica el
día que se decide, en una fila `conversion` que guarda el tipo de cambio que se
arregló en ese momento. Por eso `movimientos_cc` no tiene una columna `moneda`
sino dos de importe (`delta_ars_centavos` y `delta_usd_centavos`): es lo que
permite que una conversión mueva las dos a la vez.

Una operación del mundo real puede ser más de una fila. "Me dejó USD 2.000" y
"los contamos contra la deuda en pesos" son dos hechos distintos, y el segundo
es opcional, porque a veces esos dólares se quedan quietos como saldo a favor.
Las filas de una misma operación comparten `grupo_id`, y es el grupo lo que se
anula — nunca media operación.

| Archivo | Qué hace |
| --- | --- |
| `lib/cuenta-corriente.ts` | Las reglas, **sin tocar la base**: saldo, signos, conversión, límite, parseo de importes |
| `lib/db/cuenta.ts` | Las consultas (hoy, los saldos del listado en una sola agregada) |
| `clientes/actions.ts` | Datos del cliente — los dos roles, `requireUser()` |
| `clientes/cuenta-actions.ts` | Movimientos — **sólo admin**, detrás de `requireCuentaCorriente()` |

Que las reglas no hagan I/O no es prolijidad: es lo que deja probar la
aritmética de la plata sin levantar Postgres. `npm run prueba:cuenta` la cubre.

El tipo de cambio de una operación **siempre** es el que se pactó en esa
operación, y nunca uno de referencia.

## El CMS de contenido

Todo el copy fijo del sitio —hero, Nosotros, Club, Eventos, pie de página, age
gate, legales y la metadata de SEO— se edita desde **Contenido** en el panel.

Tres piezas, en `lib/content/`:

| Archivo | Qué hace |
| --- | --- |
| `registry.ts` | Declara **qué** se puede editar y **qué dice hoy**. El único archivo que se toca para sumar un campo |
| `get.ts` | `getContent(grupo)` — mezcla lo editado con los originales, en una consulta cacheada |
| `bucket.ts` · `image-size.ts` | Subida al bucket S3 y medidas leídas de la cabecera del archivo |

Dos decisiones que explican el resto:

- **Los textos originales viven en el registro, no en un seed de la base.** La
  tabla `content` guarda **sólo lo que alguien cambió**: una fila por campo
  editado, no por campo del sitio. Con la tabla vacía el sitio se ve exactamente
  como vino con el diseño, un deploy nuevo no arranca en blanco, y "restaurar el
  original" es borrar la fila.
- **La lectura va envuelta en `unstable_cache` con el tag `contenido`.** Sin eso,
  leer contenido volvería dinámica cada página que hoy se prerenderiza. Guardar
  en el panel invalida el tag y las rutas que declara el grupo.

Las imágenes van a un bucket de Railway, que es **privado**: no hay URL pública.
Se sirven proxeadas por `app/media/[...key]/route.ts`, y la clave de cada archivo
es el hash de su contenido — por eso la ruta puede responder con un año de caché
inmutable sin riesgo de mostrar una foto vieja.

El formato de texto es mínimo y propio (`components/rich-text.tsx`): `*acento*`,
`**destacado**`, `## subtítulo`, `- viñeta`, `[texto](destino)`. Se renderiza a
nodos de React, nunca con `dangerouslySetInnerHTML`.

## Autenticación y permisos

Tres capas, y sólo una de ellas es control de acceso:

1. **`middleware.ts`** — corre en Edge, no puede consultar Postgres. Sólo mira si
   *existe* la cookie para redirigir rápido a `/admin/login`. **No es seguridad.**
2. **`lib/auth/index.ts`** — `requireUser()` y `requireUserManager()` validan
   contra la base. Es el punto único de verdad, y va tanto en la página como en
   la Server Action. Nunca alcanza con ponerlo en una sola de las dos.
3. **`lib/auth/permissions.ts`** — quién puede qué, en funciones puras
   (`canManageUsers`, `canEditContent`, `canManageCuentaCorriente`).

### Sesiones

En base, no JWT, y a propósito: una sesión en base **se puede revocar**. Se
desactiva un usuario y sus sesiones mueren en el acto; con un JWT firmado habría
que esperar a que venza.

`sessions.id` guarda el **SHA-256 del token**, no el token. Un dump filtrado de
la base no sirve para entrar a ningún lado. Duración: 30 días fijos, sin
renovación deslizante — Next sólo deja escribir cookies desde una Server Action
o un Route Handler, nunca desde el layout que hace la verificación.

### Roles

| Rol | Alcance |
| --- | --- |
| `admin` | Todo: contenido, catálogo, precios, clientes, plata y usuarios. Puede nombrar otros admin |
| `editor` | Contenido del sitio, catálogo y la ficha de un cliente. No ve Usuarios, ni saldos, ni movimientos |

Dos escalones y no tres: con un equipo chico, un nivel intermedio agrega estados
que mantener sin agregar seguridad (el porqué largo está en `lib/db/schema.ts`).

Dos invariantes que el código defiende explícitamente: **siempre queda al menos
un `admin` activo**, y **nadie se cambia el rol ni se desactiva a sí mismo**.

## Server Actions

Van en un `actions.ts` al lado de la página que las usa. La forma es siempre la
misma:

```ts
"use server"

export async function accionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUserManager()          // 1. autorizar
  const parsed = esquema.safeParse({ ... })         // 2. validar con zod
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  // 3. reglas de negocio → { error } si no pasan
  await db.update(...)                              // 4. escribir
  revalidatePath("/admin/usuarios")                 // 5. revalidar
  return { ok: "Cambios guardados." }
}
```

El estado siempre es `{ error?: string; ok?: string }`, y el componente lo
consume con `useActionState` de React 19.

## Estilos

Un archivo `.module.css` por componente, al lado del `.tsx`. Los colores salen de
los tokens de `app/globals.css` (`--night`, `--gold`, `--heading`, `--text`,
`--muted`, `--dim`, `--chip`) — no se hardcodean.

## Scripts

| Script | Para qué |
| --- | --- |
| `scripts/worktree.ps1` | Abrir, listar y cerrar worktrees — ver [WORKTREES.md](WORKTREES.md) |
| `scripts/create-admin.mjs` | Crear el primer admin, o recuperarlo si quedó afuera |
| `scripts/migrate.mjs` | Aplicar migraciones en el deploy, sin dependencias de desarrollo |
| `scripts/prueba-cuenta.ts` | `npm run prueba:cuenta` — la aritmética de la cuenta corriente |
| `scripts/_*.mjs` | One-off temporales. Dry-run por defecto, escriben sólo con `APPLY=1` |

```powershell
npm run db:up         # base local en :5432
npm run db:migrate    # aplicar migraciones
npm run admin:crear   # primer dueño
npm run dev           # http://localhost:3000
```
