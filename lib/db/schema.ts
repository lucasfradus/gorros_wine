import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

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

    /** La **key** del objeto en el bucket, no una URL. Si mañana cambia cómo
     *  se sirven las imágenes, no hay que migrar ninguna fila. */
    logoKey: text("logo_key"),

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
