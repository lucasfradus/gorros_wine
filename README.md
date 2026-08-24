# Gorros Wine

Sitio de la vinoteca Gorros Wine (Pilar, Buenos Aires), importado desde el
proyecto de Claude Design **Vinoteca de Pilar**.

```bash
npm install
npm run db:up        # Postgres en Docker
npm run db:migrate   # crea las tablas
npm run admin:crear  # crea el usuario dueño (una sola vez)
npm run dev          # http://localhost:3000
```

## Qué diseño se implementó

`Gorros Wine - Sitio v2.dc.html` — la versión negra y dorada del sitio
completo, con Fraunces para títulos y Jost para texto. El rasgo tipográfico
de v2 es la micro-tipografía en mayúsculas con mucho tracking (antetítulos,
botones, etiquetas).

Antes de v2 se había implementado la opción **1b** del tablero de exploración
(`Gorros Wine - Home.dc.html`); v2 confirmó esa dirección pero afinó la paleta
y reestructuró la home.

Tokens en [`app/globals.css`](app/globals.css):

| Token         | Valor     | Uso                          |
| ------------- | --------- | ---------------------------- |
| `--night`     | `#0d0c0b` | Fondo                        |
| `--gold`      | `#c8a253` | Marca, acentos, botones      |
| `--heading`   | `#f5efe4` | Titulares                    |
| `--text`      | `#efe9df` | Texto general                |
| `--muted`     | `#8d867a` | Bajadas, texto secundario    |
| `--dim`       | `#6b6459` | Texto terciario, legales     |
| `--chip`      | `#b3aa9b` | Filtros y maridajes          |

Tipografías vía `next/font/google`: se autoalojan en el build, sin pedidos a
Google Fonts en runtime.

## Rutas

| Ruta              | Render   | Qué es                                     |
| ----------------- | -------- | ------------------------------------------ |
| `/`               | estático | Home v2 completa                           |
| `/catalogo`       | dinámico | Grilla con filtros; lee `?tipo=`           |
| `/producto/[id]`  | SSG (9)  | Ficha; 404 en un id inexistente            |
| `/nosotros`       | estático | Historia, valores y cierre                 |
| `/eventos`        | estático | Agenda, Caminos del Vino, cata privada     |
| `/club`           | estático | Membresía: qué incluye y cómo funciona     |
| `/carrito`        | estático | Pedido, cantidades y subtotal              |
| `/buscar`         | dinámico | Busca por nombre, bodega, uva o región     |
| `/cuenta`         | estático | Formulario de ingreso (sin auth todavía)   |
| `/terminos`       | estático | Términos y condiciones (borrador)          |
| `/privacidad`     | estático | Política de privacidad (borrador)          |
| `/admin`          | dinámico | Panel: inicio                              |
| `/admin/login`    | dinámico | Ingreso al panel (`noindex`)               |
| `/admin/usuarios` | dinámico | Usuarios del sistema: alta, rol, acceso    |
| `/admin/cuenta`   | dinámico | Cambiar la propia contraseña               |

No queda ningún enlace interno roto. También se generan `/sitemap.xml`,
`/robots.txt` y el favicon desde [`app/icon.svg`](app/icon.svg).

La home compone: hero (foto) · beneficios · etiquetas destacadas · Club ·
eventos · acerca de nosotros · reseñas · cómo comprar.

El nav apunta a `/#club`, un ancla a la banda del club en la home, como en v2;
`/club` es la página con el detalle de la membresía.

## Carrito

[`components/cart-context.tsx`](components/cart-context.tsx) guarda renglones
con cantidad, calcula subtotal y persiste en `localStorage` bajo `gw-cart`.

Dos decisiones que conviene conocer:

- **Se persiste sólo `{id, qty}`**, no el vino entero. Al releer se resuelve
  contra `lib/data`, así un carrito viejo nunca resucita un precio
  desactualizado.
- **Arranca vacío y lee `localStorage` en un efecto**, para que el primer
  render del cliente sea igual al del servidor y no haya desajuste de
  hidratación. El flag `ready` evita mostrar "carrito vacío" antes de tiempo.

El checkout todavía no existe, así que "Finalizar por WhatsApp" arma el pedido
como texto y abre `wa.me`. **El número de `shop.whatsapp` en
[`lib/data.ts`](lib/data.ts) es de ejemplo** — hay que reemplazarlo.

## Age gate

Requisito legal para venta de alcohol. El overlay se renderiza siempre en el
servidor; un script inline al principio del `<body>`
([`components/age-gate.tsx`](components/age-gate.tsx)) lee `localStorage` y
marca `<html data-age-ok="1">` **antes de pintar**, y el CSS lo oculta desde
ahí.

Se hace así, y no con estado de React, por dos razones: quien ya confirmó no
ve ningún parpadeo, y el HTML del servidor es siempre el mismo, así que no hay
desajuste de hidratación.

Para volver a verlo: `localStorage.removeItem("gw-age-ok")` y recargar.

## Base de datos

Postgres, con [Drizzle](https://orm.drizzle.team) como capa de acceso y
migraciones versionadas en `drizzle/`.

En desarrollo la base corre en Docker (`docker-compose.yml`). En producción
sólo cambia `DATABASE_URL`; el resto es igual.

```bash
npm run db:up        # levanta Postgres
npm run db:generate  # después de tocar lib/db/schema.ts
npm run db:migrate   # aplica las migraciones pendientes
npm run db:studio    # explorador visual de la base
npm run db:down      # apaga (los datos quedan en el volumen)
```

El esquema vive en [`lib/db/schema.ts`](lib/db/schema.ts). Hoy tiene dos
tablas: `users` y `sessions`.

**`users` son las cuentas del sistema, no los clientes de la vinoteca.** Los
clientes van a ser su propia tabla, con dirección, historial de pedidos y
lista de precios. Mezclarlos es el error clásico que después cuesta desarmar.

## Panel de administración

Vive en `/admin`, en el grupo de rutas `app/(admin)`. La tienda vive en
`app/(store)`. El layout raíz sólo monta `<html>`, las fuentes y los tokens,
así el panel no hereda nav, footer, age gate ni carrito.

### Ingresar

```bash
npm run admin:crear                                  # pregunta nombre y mail
npm run admin:crear -- "Nombre" mail@ejemplo.com     # o directo
```

Crea el usuario `owner`, que es el único que no se puede dar de alta desde el
panel: sin nadie adentro, nadie puede invitar. La contraseña sale de
`ADMIN_PASSWORD` si está definida; si no, se genera una al azar y se imprime
una sola vez.

**Es además la salida de emergencia**: si el mail ya existe, el script le pone
contraseña nueva, lo reactiva y lo deja como dueño. Sirve para el día en que
el dueño se quede afuera de su propio sistema.

### Modo claro y oscuro

El panel tiene tres modos —**Oscuro**, **Claro** y **Auto**— y se cambian desde
el pie de la barra lateral. La tienda no cambia: sigue siendo negra y dorada,
que es la marca.

Tres decisiones detrás:

- **La preferencia va en una cookie, no en la tabla `users`.** Así el servidor
  la lee antes de renderizar y el modo correcto se pinta de entrada: nunca hay
  un destello oscuro antes de que aparezca el claro. Además funciona en la
  pantalla de ingreso, donde todavía no hay usuario, y no cuesta una migración.
  Lo que se pierde es que la elección no viaja entre navegadores.
- **Los colores se declaran una sola vez, con `light-dark()`.** Lo único que
  cambia por modo es `color-scheme` en el contenedor del panel. No hay dos
  bloques de tokens que mantener en paralelo, y el modo "Auto" sale gratis
  porque lo resuelve el navegador. Requiere Chrome 123+, Safari 17.5+ o
  Firefox 120+.
- **El selector no lleva JavaScript propio.** Son tres botones de envío en un
  formulario, en un componente de servidor. Anda con el JS deshabilitado, y con
  JS React lo resuelve sin recargar.

Los colores del modo claro no se eligieron a ojo: todo el texto pasa WCAG AA
(4.5:1) sobre los dos fondos, en los dos modos. El borde de los campos de
formulario llega a 3:1, que es el mínimo para un componente de interfaz —por eso
las opacidades del dorado son 0.55 en oscuro y 0.72 en claro, y no menos.

### Roles

| Rol      | Puede                                                       |
| -------- | ----------------------------------------------------------- |
| `owner`  | Todo, incluido nombrar a otros dueños                       |
| `admin`  | Contenido y usuarios, pero **no** puede tocar a un `owner`   |
| `editor` | Sólo contenido. No ve la sección Usuarios                   |

Tres reglas evitan que alguien se quede afuera de su propio sistema: nadie
puede cambiarse el rol a sí mismo, nadie puede desactivar su propia cuenta, y
no se puede degradar ni desactivar al último dueño activo.

### Sesiones

Sesiones en base, no JWT. La diferencia que importa es que se pueden
**revocar**: desactivar a alguien lo echa en el acto, y cambiarle la
contraseña le cierra todas las pantallas abiertas. Con un JWT firmado habría
que esperar a que venza.

Detalles que conviene conocer antes de tocar
[`lib/auth/session.ts`](lib/auth/session.ts):

- **En la base se guarda el SHA-256 del token, no el token.** Un dump robado
  de `sessions` no sirve para entrar a ningún lado.
- **Duran 30 días, fijos, sin renovación deslizante.** Renovar exige reescribir
  la cookie en cada request, y en Next las cookies sólo se pueden tocar desde
  una Server Action o un Route Handler — nunca desde el layout que hace la
  verificación.
- **La cookie es `httpOnly` + `sameSite=lax`**, y `secure` en producción.

### Quién controla el acceso

[`middleware.ts`](middleware.ts) **no** es el control de acceso: corre en Edge,
no puede consultar Postgres, y sólo mira si la cookie existe para redirigir
rápido. Quién es cada uno se decide siempre contra la base, en
`requireUser()` de [`lib/auth/index.ts`](lib/auth/index.ts), que llaman tanto
las páginas como las Server Actions.

`/admin/login` queda deliberadamente fuera del middleware. Si sacara de ahí a
todo el que trae cookie, una cookie vencida entraría en un rebote infinito
entre el panel y el ingreso.

### Freno a la fuerza bruta

Cinco intentos fallidos traban la cuenta 15 minutos. El contador vive en la
base y no en memoria, así sobrevive a un reinicio y funciona con más de una
instancia. Mientras está trabada no entra ni con la contraseña correcta;
cambiársela desde el panel la destraba.

El mensaje de error es el mismo para "ese mail no existe" y "esa contraseña
está mal", y cuando el mail no existe igual se gasta el tiempo de un bcrypt:
si no, la demora delataría qué mails están dados de alta.

### No hay borrar usuarios, sólo desactivar

Es a propósito. En cuanto los usuarios tengan cosas colgando —quién cargó un
precio, quién despachó un pedido— borrar una fila deja huérfano ese historial.
Desactivar corta el acceso igual de rápido y no rompe nada hacia atrás.

## Diferencias respecto del diseño

El diseño es un lienzo fijo de 1180 px con todo en `style=` inline. Al pasarlo
a código:

- **Responsive.** Cortes en 1000 / 900 / 820 / 700 / 560 px: las grillas pasan
  de 4 → 2 → 1 columna, los bloques partidos se apilan, y el nav reordena los
  enlaces debajo del logo.
- **Semántica y accesibilidad.** Los `<span>` del diseño son ahora `<button>`,
  `<a>`, headings y listas, con `:focus-visible` y textos sólo para lectores de
  pantalla en el carrito, "Agregar" y "Reservar".
- **Filtros funcionales.** En el diseño las píldoras del catálogo son
  decorativas; acá filtran de verdad y son acumulables.
- **Bodegas derivadas de los datos.** El diseño lista 3 fijas; acá salen de
  `wines`, así que aparecen solas al agregar una.
- **Botón "Agregar" en las tarjetas.** v2 no lo tiene (la tarjeta sólo lleva a
  la ficha). Se mantuvo porque ya estaba y es útil en una tienda —
  si molesta, se saca de [`components/wine-card.tsx`](components/wine-card.tsx).
- **Nav sticky**, tomado de la versión Sitio.

## Accesibilidad

Todos los colores de texto pasan WCAG AA sobre los dos fondos del sitio. Una
excepción respecto del diseño: v2 usa `#6b6459` para los textos terciarios
(línea legal, precio unitario, "Quitar"), que da **3.34:1** y no llega al
mínimo de 4.5 para texto chico. Se aclaró a `#857c6e` (4.75:1), lo justo para
cumplir manteniendo la proporción del tono.

## Pendiente

### Front

- **Fotos.** Sólo `hero-home` está cargada en el proyecto de design y ya se usa
  ([`public/hero-home.webp`](public/hero-home.webp)). Los demás huecos se
  renderizan con [`components/photo-slot.tsx`](components/photo-slot.tsx):
  `evento-1`, `evento-2` (home), `evento-3`, `evento-4` (eventos),
  `nosotros-home` y `nosotros-hero`. Cuando se carguen, se extraen igual que el
  hero y se pasan a `next/image`.
- **Copy de producto.** Todas las fichas comparten `placeholderDescription`,
  tal como el diseño. Faltan las notas de cata reales.
- **Legales.** `/terminos` y `/privacidad` son un borrador genérico, marcado
  como tal en la propia página. Necesitan revisión de un abogado y los datos de
  la razón social.
- **Datos del local.** `shop` en [`lib/data.ts`](lib/data.ts) tiene WhatsApp y
  mail de ejemplo.
- **`NEXT_PUBLIC_SITE_URL`.** Sin definir, el sitemap y las tarjetas de Open
  Graph apuntan a `localhost:3000`.

### Backend

Hecho: base de datos, ingreso al panel y administración de usuarios del
sistema. Lo que sigue, en orden:

- **Catálogo en la base.** [`lib/data.ts`](lib/data.ts) todavía es estático: 9
  vinos y 4 eventos escritos a mano. Es lo próximo, y con importación desde
  planilla — el catálogo real son 400+ etiquetas que hoy viven en un Excel.
- **Clientes.** Su propia tabla, separada de `users`. Dirección, historial de
  pedidos y lista de precios.
- **Checkout y pagos.** Hoy el pedido sale por WhatsApp. Mercado Pago
  (Checkout Pro) conviviendo con ese botón.
- **Pedidos y mails.** Persistencia de órdenes, estados y confirmaciones.
- **Envíos.** Costo por código postal. Se vende a todo el país.
- **Cuentas de cliente.** `/cuenta` (la de la tienda) es sólo el formulario; al
  enviar avisa que las cuentas no están habilitadas.
- **Newsletter.** El formulario del footer avisa en vez de postear.
- **Reservas de eventos.** El botón "Reservar" todavía no hace nada.
- **Registro de auditoría.** Quién cambió qué y cuándo. No está: hoy sólo se
  guarda el último ingreso de cada usuario.
- **Recuperar contraseña por mail.** No está. Hoy la restablece un
  administrador desde el panel, o `npm run admin:crear` para el dueño.

## Despliegue

El sitio vive en Railway, en el proyecto `gorros-wine`: un servicio web
conectado a `lucasfradus/gorros_wine` que despliega solo con cada push a
`main`, y un Postgres.

- **`DATABASE_URL`** es una referencia al servicio de Postgres
  (`${{Postgres.DATABASE_URL}}`), no un valor copiado: si Railway rota la
  contraseña, el web la toma sola. Apunta a la red privada del proyecto, así
  que la base **no está expuesta a internet**.
- **`NEXT_PUBLIC_SITE_URL`** tiene que estar seteada o el sitemap y las
  tarjetas de Open Graph apuntan a `localhost`.

### Las migraciones corren solas

[`railway.json`](railway.json) declara `preDeployCommand`, así que Railway
corre `npm run db:migrate` **antes** de levantar la versión nueva: si la
migración falla, el deploy se aborta y queda corriendo la versión anterior.

Por eso [`scripts/migrate.mjs`](scripts/migrate.mjs) es JavaScript plano y usa
sólo dependencias de producción. `drizzle-kit` no sirve para esto: es una
dependencia de desarrollo y no existe en la imagen desplegada. Sigue siendo el
que **genera** el SQL (`npm run db:generate`); `migrate.mjs` sólo lo aplica,
y es el mismo camino en local y en producción.

Con `DATABASE_URL` faltando, `next build` **falla a propósito**: el panel se
importa al recolectar la configuración de las páginas y [`lib/db/index.ts`](lib/db/index.ts)
corta ahí. Es preferible a desplegar un sitio cuyo panel explota al primer clic.

### El primer usuario en producción

La base arranca vacía y el dueño no se puede crear desde el panel. Se crea una
vez, desde adentro del contenedor:

```bash
railway ssh --service gorros-wine
npm run admin:crear -- "Nombre Apellido" mail@ejemplo.com
```

`railway ssh` necesita una clave SSH registrada en la cuenta. Si la terminal
responde *"No SSH keys found"*, se genera una vez con `ssh-keygen -t ed25519`.

Por eso [`scripts/create-admin.mjs`](scripts/create-admin.mjs) también es
JavaScript plano con SQL a mano, y no usa Drizzle: en la imagen desplegada no
hay `tsx` para ejecutar TypeScript. El precio es que las columnas de `users`
aparecen escritas a mano ahí; si cambia el esquema, cambia ese INSERT.

## Nota sobre el cache de Next

No corras `npm run build` mientras `npm run dev` está activo: comparten el
directorio `.next` y el build de producción pisa los chunks que el dev server
tiene abiertos, con errores del tipo `Cannot find module './72.js'`. Si pasa,
frená el dev server, borrá `.next` y volvé a arrancar.
