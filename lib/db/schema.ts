import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import type { ImagenValor } from "@/lib/content/types";

/**
 * Roles del panel. Son los del *sistema*, no los del negocio: un cliente que
 * compra vinos no es un `user`, va a tener su propia tabla.
 *
 * - `admin`  — todo, incluido nombrar a otros admin.
 * - `editor` — sólo contenido (catálogo, precios, eventos). No ve usuarios.
 *
 * Dos escalones y no tres a propósito. Un tercer nivel intermedio sólo tiene
 * sentido cuando hay gente suficiente para que la diferencia importe; con un
 * equipo chico agrega estados que mantener sin agregar seguridad. Lo que
 * protege al sistema no es la cantidad de roles, sino las reglas que impiden
 * quedarse sin admins (ver `usuarios/actions.ts`).
 */
export const userRole = pgEnum("user_role", ["admin", "editor"]);
export type UserRole = (typeof userRole.enumValues)[number];

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),

  /** Siempre en minúscula: se normaliza al escribir, así el UNIQUE alcanza
   *  para que no entren "Lucas@x.com" y "lucas@x.com" como dos cuentas. */
  email: text("email").notNull().unique(),
  name: text("name").notNull(),

  /** bcrypt. Nunca se guarda ni se loguea la contraseña en claro. */
  passwordHash: text("password_hash").notNull(),

  role: userRole("role").notNull().default("editor"),

  /** Se desactiva en vez de borrar: ver el comentario de `users` más abajo. */
  isActive: boolean("is_active").notNull().default(true),

  /** Freno a la fuerza bruta. Se guarda en la base y no en memoria para que
   *  sobreviva a un reinicio y funcione con más de una instancia. */
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),

  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Sesiones en base, no JWT.
 *
 * La diferencia que importa: una sesión en base se puede **revocar**. Si a
 * alguien le roban la notebook, se desactiva el usuario y sus sesiones mueren
 * en el acto. Con un JWT firmado habría que esperar a que venza.
 *
 * `id` guarda el SHA-256 del token, no el token. Si algún día se filtra un
 * dump de la base, esos hashes no sirven para entrar a ningún lado.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Para poder mirar desde dónde se abrió cada sesión. */
    userAgent: text("user_agent"),
    ip: text("ip"),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;

/** El usuario tal como viaja a la interfaz: sin el hash de la contraseña. */
export type PublicUser = Omit<User, "passwordHash">;

/**
 * Contenido editable del sitio: sólo lo que alguien **cambió**.
 *
 * El texto original de cada campo vive en `lib/content/registry.ts`, en código.
 * Acá abajo no hay una fila por campo del sitio, hay una fila por campo tocado:
 * si nadie editó el título del hero, no existe `home.heroTitle` y la página
 * muestra el del registro. Tres consecuencias que valen la tabla:
 *
 * - Con la base vacía el sitio se ve exactamente como se ve hoy, y un deploy
 *   nuevo no arranca en blanco.
 * - "Restaurar el original" es borrar la fila, no recordar qué decía antes.
 * - El copy sigue versionado en git, que es donde se revisa por qué cambió.
 *
 * `value` es jsonb y no text porque el mismo campo guarda tres formas según su
 * tipo en el registro: un string, la lista de ítems, o la referencia a una
 * imagen. Postgres valida que sea JSON; que además tenga la forma que el
 * registro declara lo valida `lib/content/get.ts` al leer.
 */
export const content = pgTable("content", {
  /** `<grupo>.<campo>`, como `home.heroTitle`. Lo arma el registro. */
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  /** Quién lo tocó. `set null` y no cascade: que se borre la cuenta no puede
   *  hacer desaparecer el texto que está publicado en el sitio. */
  updatedBy: uuid("updated_by").references(() => users.id, {
    onDelete: "set null",
  }),
});

/**
 * Inventario de las imágenes subidas desde el panel. Los bytes viven en el
 * bucket S3; acá queda con qué servirlas y de dónde salieron.
 *
 * `key` es `img/<sha256 recortado>.<ext>`: **la clave es el contenido**. De ahí
 * salen dos cosas gratis. Una, subir dos veces la misma foto no duplica nada,
 * porque cae en la misma clave. La otra, y la que importa: si el contenido
 * cambia la URL cambia, así que `/media/...` puede servirse con un año de
 * caché inmutable sin riesgo de mostrar una foto vieja.
 */
export const media = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  mime: text("mime").notNull(),
  bytes: integer("bytes").notNull(),

  /** Leídos de la cabecera del archivo al subirlo. Nulos si el formato no se
   *  supo medir: `next/image` puede maquetar igual con `fill`. */
  width: integer("width"),
  height: integer("height"),

  /** El nombre con el que llegó, sólo para reconocerla en una lista. */
  originalName: text("original_name"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdBy: uuid("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
});

export type Content = typeof content.$inferSelect;
export type NewContent = typeof content.$inferInsert;
export type Media = typeof media.$inferSelect;
export type NewMedia = typeof media.$inferInsert;
// ---------------------------------------------------------------- catálogo

/**
 * Tipos de vino. Son los cuatro que la tienda ya filtra en el catálogo (ver
 * `components/catalog-view.tsx`). Si algún día entra un naranjo o un dulce, se
 * agrega el valor acá y drizzle-kit genera el `ALTER TYPE`.
 */
export const tipoVino = pgEnum("tipo_vino", [
  "Tinto",
  "Blanco",
  "Espumante",
  "Rosado",
]);
export type TipoVino = (typeof tipoVino.enumValues)[number];

/**
 * Moneda del precio de lista.
 *
 * Casi todo va en pesos; el enum existe por los importados que la bodega
 * cotiza en dólares. El equivalente en pesos **no se guarda**: se calcula
 * contra la última fila de `cotizaciones`. Si se guardara, cada movimiento del
 * dólar obligaría a reescribir el catálogo entero.
 */
export const monedaPrecio = pgEnum("moneda", ["ARS", "USD"]);
export type Moneda = (typeof monedaPrecio.enumValues)[number];

/**
 * Categorías del catálogo.
 *
 * La vinoteca no vende sólo vino: también accesorios, heladeras y regalería.
 * La categoría es **qué clase de cosa es** el producto, y es lo que decide qué
 * ficha se le pide: una heladera no tiene bodega, ni varietal, ni añada.
 *
 * `esVino` es esa decisión, explícita y no adivinada por el nombre. Con un
 * slug reservado —"si la categoría se llama vino…"— alcanzaría con que alguien
 * la renombre para romper el formulario.
 *
 * Ojo con el solapamiento: **el estilo del vino (Tinto, Blanco…) NO va acá**,
 * va en `productos.tipo`. Si además se armaran categorías "Vino > Tintos", el
 * mismo dato quedaría en dos lugares y se irían separando. Las subcategorías
 * son para lo demás: "Accesorios > Copas".
 */
export const categorias = pgTable(
  "categorias",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),

    /** El nombre no es único: dos ramas distintas pueden tener un "Otros". */
    nombre: text("nombre").notNull(),

    /** La categoría padre, si es una subcategoría. `restrict`: una categoría
     *  con hijas no se borra. El tipo de retorno explícito lo pide Drizzle
     *  para poder resolver una referencia a la propia tabla. */
    parentId: uuid("parent_id").references((): AnyPgColumn => categorias.id, {
      onDelete: "restrict",
    }),

    /** Para ordenar el menú a mano: el orden alfabético casi nunca es el que
     *  conviene mostrar. */
    orden: integer("orden").notNull().default(0),

    /** ¿Los productos de esta categoría llevan ficha de vino? Se hereda del
     *  padre al guardar, no se calcula al leer: así una consulta nunca tiene
     *  que subir por el árbol para saberlo. */
    esVino: boolean("es_vino").notNull().default(false),

    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("categorias_padre_idx").on(t.parentId),
    index("categorias_activas_idx").on(t.isActive),
  ],
);

/**
 * Varietales, con ABM propio.
 *
 * Antes eran una lista fija en `lib/catalogo.ts` y un `text[]` en el producto.
 * Con tabla, corregir "Cabernet Sauvingon" es editar una fila y no salir a
 * buscar en qué productos quedó mal escrito.
 */
export const varietales = pgTable(
  "varietales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    nombre: text("nombre").notNull().unique(),
    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("varietales_activos_idx").on(t.isActive)],
);

/**
 * Bodegas.
 *
 * Son el proveedor, no una etiqueta de marketing: por eso viven acá el
 * contacto comercial y las condiciones, que nunca se muestran en la tienda.
 */
export const bodegas = pgTable(
  "bodegas",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Para la URL pública del día que la tienda lea de la base. Sale del
     *  nombre y se puede corregir a mano. */
    slug: text("slug").notNull().unique(),
    nombre: text("nombre").notNull().unique(),

    /**
     * El logo, con la misma forma que la foto de un evento: `jsonb` con
     * `{ src, alt, width, height }`.
     *
     * Reemplaza a un `logo_key` de texto que se había pensado antes de que
     * existiera el gateway de imágenes y que nunca llegó a usarse. Guardar sólo
     * la key obligaría a rearmar el `src` en cada lectura y, peor, dejaría
     * afuera el alto y el ancho: sin ellos `next/image` no puede reservar la
     * caja y la maqueta salta al cargar.
     */
    logo: jsonb("logo").$type<ImagenValor | null>(),

    pais: text("pais"),
    sitioWeb: text("sitio_web"),

    /** El contacto va en tres columnas y no en un campo libre: separado se
     *  puede armar el `mailto:` y el link de WhatsApp; todo junto, no. */
    contactoNombre: text("contacto_nombre"),
    contactoEmail: text("contacto_email"),
    contactoTelefono: text("contacto_telefono"),

    /** Plazos de entrega, mínimos de compra, condiciones de pago. Texto libre
     *  a propósito: es lo que hoy vive en un WhatsApp o en la cabeza de
     *  alguien, y estructurarlo antes de ver qué se repite es adivinar. */
    notas: text("notas"),

    /**
     * ¿Va en la franja de bodegas de la home?
     *
     * Lo lee `lib/bodegas.ts`, que además exige logo cargado y `isActive`: sin
     * logo no hay nada que dibujar, y una bodega archivada es un proveedor al
     * que se dejó de comprarle.
     *
     * Es una decisión editorial y por eso está separada de `isActive`: una
     * bodega puede seguir activa —se le compra, tiene vinos publicados— sin
     * ser una de las que se muestran en la portada.
     */
    mostrarEnHome: boolean("mostrar_en_home").notNull().default(false),

    /** Se archiva en vez de borrar, igual que los usuarios y por lo mismo:
     *  los productos cuelgan de acá. */
    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("bodegas_activas_idx").on(t.isActive)],
);

/**
 * Productos del catálogo.
 *
 * Una sola tabla para todo lo que se vende —vino, accesorios, heladeras,
 * regalería—, con los campos de vino en nullable y la **categoría** decidiendo
 * cuáles se piden. Se eligió así, y no una tabla `vinos` aparte, porque el
 * listado, los filtros y la búsqueda quedan sin joins; que es lo que va a usar
 * la tienda cuando lea de acá. El costo es que una heladera guarda media docena
 * de columnas en NULL.
 *
 * Lo que la base **no** garantiza, entonces, lo garantiza la Server Action:
 * que un producto de categoría de vino traiga bodega, tipo y varietales, y que
 * uno que no lo es no traiga nada de eso.
 *
 * Mientras la tienda siga leyendo `lib/data.ts`, esta tabla la usa sólo el
 * panel. Aun así el modelo sigue lo que la tienda **ya renderiza** —tipo,
 * región, guarda, maridajes—, para que migrar el render después sea una
 * mudanza y no un rediseño.
 */
export const productos = pgTable(
  "productos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    nombre: text("nombre").notNull(),

    /** Qué clase de cosa es. Es lo único que decide qué ficha se le pide. */
    categoriaId: uuid("categoria_id")
      .notNull()
      .references(() => categorias.id, { onDelete: "restrict" }),

    /** Nullable desde que el catálogo dejó de ser sólo vino: una copa no viene
     *  de una bodega. `restrict` y no `cascade`: borrar una bodega no puede
     *  llevarse puestos sus vinos. Para sacarla de circulación está `isActive`. */
    bodegaId: uuid("bodega_id").references(() => bodegas.id, {
      onDelete: "restrict",
    }),

    /** El estilo del vino. Nullable por lo mismo que `bodegaId`. */
    tipo: tipoVino("tipo"),

    /** "Valle de Uco · Mendoza". Va en el producto y no en la bodega: una
     *  misma bodega hace vinos de varios valles. */
    region: text("region"),

    /** Nullable a propósito: los espumantes y varios blends no tienen añada. */
    anada: integer("anada"),

    /** En centavos. Guardar plata en float termina en $14899.99999. */
    precioCentavos: integer("precio_centavos").notNull(),
    moneda: monedaPrecio("moneda").notNull().default("ARS"),

    stock: integer("stock").notNull().default(0),

    /** Se archiva en vez de borrar: mañana hay pedidos colgando de esta fila. */
    isActive: boolean("is_active").notNull().default(true),

    /** Lo que la home levanta como destacados. Hoy eso es un `slice(0, 4)`
     *  sobre un array; con una columna lo elige quien carga el catálogo. */
    destacado: boolean("destacado").notNull().default(false),

    /** Notas de cata. Hoy las nueve etiquetas comparten el mismo párrafo de
     *  relleno (`placeholderDescription` en `lib/data.ts`). */
    descripcion: text("descripcion"),

    /** "Listo para beber", "Guarda 5 años". Es una fila de la ficha. */
    guarda: text("guarda"),
    maridajes: text("maridajes").array().notNull().default([]),

    /** Para distinguir magnums y medias de la botella de 750. Nullable: una
     *  heladera no se mide en mililitros. */
    volumenMl: integer("volumen_ml"),

    /** Key en el bucket, misma razón que `bodegas.logoKey`. */
    imagenKey: text("imagen_key"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("productos_categoria_idx").on(t.categoriaId),
    index("productos_bodega_idx").on(t.bodegaId),
    index("productos_activos_idx").on(t.isActive),
  ],
);

/**
 * Qué uvas lleva cada vino.
 *
 * Tabla intermedia y no un `text[]` en el producto: con los varietales en su
 * propia tabla, la relación tiene que ir por id. Así renombrar un varietal no
 * obliga a recorrer productos, y el filtro por uva es un join exacto en vez de
 * la búsqueda por subcadena que hace hoy `catalog-view.tsx`.
 *
 * `cascade` del lado del producto —si algún día se borra, sus uvas se van con
 * él— y `restrict` del lado del varietal: uno que está en uso no se borra.
 */
export const productoVarietales = pgTable(
  "producto_varietales",
  {
    productoId: uuid("producto_id")
      .notNull()
      .references(() => productos.id, { onDelete: "cascade" }),
    varietalId: uuid("varietal_id")
      .notNull()
      .references(() => varietales.id, { onDelete: "restrict" }),
  },
  (t) => [
    primaryKey({ columns: [t.productoId, t.varietalId] }),
    index("producto_varietales_varietal_idx").on(t.varietalId),
  ],
);

/**
 * Historial de la cotización del dólar.
 *
 * Historial y no una fila que se pisa, por dos razones. Leer la vigente es un
 * `orderBy(desc(createdAt)).limit(1)`, así que no hay upsert que escribir ni
 * fila semilla que crear. Y queda asentado quién movió el dólar y cuándo, que
 * es justo lo que se pregunta cuando un precio no cierra.
 */
export const cotizaciones = pgTable(
  "cotizaciones",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Cuántos centavos de peso vale un dólar. Entero y en centavos, por la
     *  misma razón que los precios. */
    arsPorUsdCentavos: integer("ars_por_usd_centavos").notNull(),

    /** Quién la cargó. Nullable porque también podría cargarla un script sin
     *  nadie detrás. */
    createdBy: uuid("created_by").references(() => users.id),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("cotizaciones_fecha_idx").on(t.createdAt)],
);

export type Categoria = typeof categorias.$inferSelect;
export type NewCategoria = typeof categorias.$inferInsert;
export type Varietal = typeof varietales.$inferSelect;
export type NewVarietal = typeof varietales.$inferInsert;
export type Bodega = typeof bodegas.$inferSelect;
export type NewBodega = typeof bodegas.$inferInsert;
export type Producto = typeof productos.$inferSelect;
export type NewProducto = typeof productos.$inferInsert;
export type Cotizacion = typeof cotizaciones.$inferSelect;

/**
 * La agenda de catas y encuentros.
 *
 * Antes eran cuatro objetos escritos a mano en `lib/data.ts`, con el día y el
 * mes como texto suelto y el precio con el signo pesos adentro. Alcanzaba para
 * maquetar, pero no para ordenar por fecha ni para que alguien corrija una
 * fecha sin abrir el editor y desplegar.
 *
 * Un evento es **un día** y no un rango: el diseño muestra "18 · Jul" y nada
 * más. Los que duran dos días y los que se repiten todas las semanas no entran
 * acá; cuando entren van a necesitar más que una columna, y conviene decidirlo
 * con el caso real a la vista.
 */
export const eventos = pgTable(
  "eventos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    titulo: text("titulo").notNull(),

    /**
     * El día del evento, y la única fecha que se guarda: el día y el mes de la
     * tarjeta salen de acá. Tenerlos por separado —como estaban— es asegurarse
     * de que algún día discrepen.
     *
     * `date` y no `timestamp`, y en modo string: el valor viaja como
     * "2026-09-18" desde Postgres hasta el `<input type="date">` y de vuelta,
     * sin pasar nunca por un `Date`. Es lo que hace que la agenda no tenga que
     * saber nada de husos horarios, con producción corriendo en UTC.
     */
    comienza: date("comienza", { mode: "string" }).notNull(),

    /** Aparte del detalle porque es lo que alguien mira primero para saber si
     *  le queda cerca. */
    lugar: text("lugar").notNull(),

    /** La línea corta que acompaña al título: "8 etiquetas a ciegas". */
    detalle: text("detalle"),

    /** La misma forma que las imágenes del CMS, a propósito: así la sube el
     *  mismo campo del panel y la pinta el mismo `<ContentImage>`. Nula
     *  mientras nadie cargue una, y ahí queda el hueco rayado del diseño. */
    imagen: jsonb("imagen").$type<ImagenValor | null>(),

    /** Un evento a medio cargar no sale al aire. Arranca en `false` para que
     *  el borrador sea el estado por omisión y publicar sea deliberado. */
    publicado: boolean("publicado").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  /** La tienda siempre pregunta lo mismo: los publicados, por fecha. */
  (t) => [index("eventos_agenda_idx").on(t.publicado, t.comienza)],
);

export type Evento = typeof eventos.$inferSelect;
export type NewEvento = typeof eventos.$inferInsert;

/* ─────────────────────────────  Clientes  ───────────────────────────── */

/**
 * Acá **no** se declara un enum `moneda`, aunque el módulo trabaje con dos.
 *
 * Ninguna columna de la cuenta corriente guarda una moneda: los importes viven
 * en dos columnas separadas (`deltaArsCentavos` y `deltaUsdCentavos`), que es
 * lo que permite que una `conversion` mueva las dos a la vez. Un enum que no
 * tipa ninguna columna sólo habría creado un tipo de Postgres al pedo — y uno
 * que choca con el `moneda` del catálogo, que sí lo usa para el precio de
 * lista. El tipo de TypeScript que necesitan los formularios está en
 * `lib/cuenta-corriente.ts`.
 */

/**
 * Los clientes del negocio, que no son los `users` del panel: un cliente compra
 * vino y debe plata, un user entra al admin. Nunca fueron la misma cosa.
 *
 * No hay columna `saldo`, y es a propósito: el saldo se calcula sumando los
 * movimientos (ver `movimientosCc`). Un saldo guardado es la forma clásica de
 * que la cuenta y el historial dejen de coincidir sin que nadie sepa cuál de
 * los dos miente.
 */
export const clientes = pgTable(
  "clientes",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    nombre: text("nombre").notNull(),

    /** Cómo lo llaman de verdad: "Pepe el del restaurante". Se busca por acá
     *  tanto como por el nombre, porque es lo que uno recuerda. */
    apodo: text("apodo"),

    telefono: text("telefono"),

    /** Único cuando está: en Postgres un UNIQUE deja pasar varios NULL, así que
     *  esto alcanza sin índice parcial. Se normaliza a minúscula al escribir,
     *  igual que en `users`.
     *
     *  Está pensado para el día que el cliente entre a la web a mirar su
     *  cuenta: ese login va a colgar de esta fila y no de `users`. */
    email: text("email").unique(),

    /** CUIT o DNI, y como **texto**: tiene ceros a la izquierda y guiones, y
     *  ninguna de las dos cosas sobrevive a un tipo numérico. */
    documento: text("documento"),
    razonSocial: text("razon_social"),

    direccion: text("direccion"),

    /** El campo para lo que no entra en ningún casillero: "paga a fin de mes",
     *  "prefiere tintos". Interno, no lo ve el cliente. */
    notas: text("notas"),

    /** Habilita fiar. Un flag y no un tipo de cliente aparte: el que hoy paga
     *  todo y mañana pide fiado se habilita acá y no hay nada que migrar. */
    cuentaCorriente: boolean("cuenta_corriente").notNull().default(false),

    /** Límite por moneda y no uno solo, porque el sistema **no tiene** un tipo
     *  de cambio de referencia —cada cotización se arregla por operación— y sin
     *  eso un límite mixto no se puede evaluar sin inventar un número.
     *  `null` es sin límite. Pasarse avisa, no bloquea: quien decide fiar de
     *  más es el dueño. */
    limiteArsCentavos: bigint("limite_ars_centavos", { mode: "number" }),
    limiteUsdCentavos: bigint("limite_usd_centavos", { mode: "number" }),

    /** Se archiva en vez de borrar: con movimientos colgando, borrar la fila
     *  deja huérfano todo el historial de la cuenta. */
    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("clientes_activos_idx").on(t.isActive),
    index("clientes_nombre_idx").on(t.nombre),
  ],
);

/**
 * Qué clase de movimiento es. Sirve para etiquetar y filtrar; **el que mueve el
 * saldo es el importe, no el tipo**, así que agregar un tipo nuevo no cambia
 * ninguna cuenta.
 *
 * - `saldo_inicial` — lo que ya venía debiendo cuando se lo dio de alta.
 * - `cargo`         — se llevó mercadería.
 * - `pago`          — entregó plata.
 * - `conversion`    — se acordó pasar saldo de una moneda a la otra.
 * - `ajuste`        — corrección o redondeo, con motivo escrito.
 */
export const movimientoTipo = pgEnum("movimiento_tipo", [
  "saldo_inicial",
  "cargo",
  "pago",
  "conversion",
  "ajuste",
]);
export type MovimientoTipo = (typeof movimientoTipo.enumValues)[number];

/**
 * El libro de la cuenta corriente. Se escribe y no se toca: acá no hay UPDATE
 * ni DELETE de un movimiento. Un error se corrige agregando la operación
 * inversa (`anulaGrupoId`), y así el saldo del mes pasado sigue siendo el que
 * era cuando el cliente lo miró.
 *
 * **Los saldos son dos y viven separados**, uno por moneda. El dólar no se
 * pesifica solo: se pesifica el día que se decide, y ese día es un movimiento
 * `conversion` con la cotización que se arregló en el momento.
 *
 * Una operación del mundo real puede necesitar más de una fila. "Me dejó USD
 * 2.000 y los contamos contra la deuda en pesos" son **dos hechos distintos**
 * —recibí dólares; los apliqué— y el segundo es opcional, porque a veces esos
 * dólares se quedan quietos como saldo a favor. Las filas de una misma
 * operación comparten `grupoId`, y es el grupo lo que se anula, nunca media
 * operación.
 */
export const movimientosCc = pgTable(
  "movimientos_cc",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    clienteId: uuid("cliente_id")
      .notNull()
      .references(() => clientes.id, { onDelete: "restrict" }),

    /** La fecha del hecho, no la de la carga: la mercadería salió el viernes
     *  aunque esto se anote el lunes. Por eso es editable y no un `defaultNow`
     *  a secas. */
    fecha: timestamp("fecha", { withTimezone: true }).notNull().defaultNow(),

    tipo: movimientoTipo("tipo").notNull(),

    /** Qué fue: "6 cajas Malbec Reserva", "efectivo en dólares". Hoy se escribe
     *  a mano; cuando exista el módulo de ventas, el movimiento va a poder
     *  colgar de una venta y esto se llena solo. */
    detalle: text("detalle").notNull(),

    /** Cuánto mueve, **en centavos** y con signo: positivo es a favor del
     *  cliente, negativo es deuda. En centavos porque guardar plata en coma
     *  flotante termina en $1999,9999999.
     *
     *  Casi siempre uno de los dos es 0. Los dos se mueven juntos sólo en una
     *  `conversion`, que es justamente pasar de una moneda a la otra. */
    deltaArsCentavos: bigint("delta_ars_centavos", { mode: "number" })
      .notNull()
      .default(0),
    deltaUsdCentavos: bigint("delta_usd_centavos", { mode: "number" })
      .notNull()
      .default(0),

    /** Pesos por dólar, tal como se pactó. Se guarda aunque se podría despejar
     *  dividiendo los dos importes, porque **es el número que se estrecharon la
     *  mano** y es el que el cliente va a discutir si discute algo. La
     *  cotización es el dato de entrada; el importe en pesos sale de ella.
     *  `numeric` y no `real`: acá tampoco entra un float. */
    cotizacion: numeric("cotizacion", { precision: 14, scale: 4 }),

    /** La operación a la que pertenece esta fila. Una operación simple es un
     *  grupo de una sola. */
    grupoId: uuid("grupo_id").notNull(),

    /** Si esta operación anula otra, el `grupoId` de aquella. No es una foreign
     *  key porque apunta a un grupo —varias filas— y no a un `id` único.
     *
     *  Anular no necesita ningún filtro al sumar: como el contramovimiento
     *  tiene el importe invertido, el par se cancela solo. Esto sirve para
     *  *mostrar* lo anulado tachado, no para calcular. */
    anulaGrupoId: uuid("anula_grupo_id"),

    /** Quién lo cargó. Queda en `null` si ese usuario se borra alguna vez: vale
     *  más el movimiento sin autor que perder el movimiento. */
    creadoPor: uuid("creado_por").references(() => users.id, {
      onDelete: "set null",
    }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("movimientos_cliente_fecha_idx").on(t.clienteId, t.fecha),
    index("movimientos_grupo_idx").on(t.grupoId),
  ],
);

export type Cliente = typeof clientes.$inferSelect;
export type NewCliente = typeof clientes.$inferInsert;
export type MovimientoCc = typeof movimientosCc.$inferSelect;
export type NewMovimientoCc = typeof movimientosCc.$inferInsert;
