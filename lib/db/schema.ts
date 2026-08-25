import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
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

/**
 * La agenda de catas y encuentros.
 *
 * Antes eran cuatro objetos escritos a mano en `lib/data.ts`, con el día y el
 * mes como texto suelto y el precio con el signo pesos adentro. Alcanzaba para
 * maquetar, pero no para ordenar por fecha ni para que alguien corrija un
 * horario sin abrir el editor y desplegar.
 *
 * Un evento es **una** fecha y no un rango: el diseño muestra "18 · Jul" y
 * "19:30 hs", nada más. Los que duran dos días y los que se repiten todas las
 * semanas no entran acá; cuando entren van a necesitar más que una columna, y
 * conviene decidirlo con el caso real a la vista.
 */
export const eventos = pgTable(
  "eventos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    titulo: text("titulo").notNull(),

    /**
     * El instante en que arranca, y la única fecha que se guarda: el día, el
     * mes y la hora del listado se derivan de acá. Tenerlos por separado —como
     * estaban— es asegurarse de que algún día discrepen.
     *
     * Se lee y se escribe siempre en la zona de Buenos Aires, fija en
     * `lib/format.ts`: producción corre en UTC y quien carga el evento está
     * pensando en la hora del local.
     */
    comienza: timestamp("comienza", { withTimezone: true }).notNull(),

    /** Aparte del detalle porque es lo que alguien mira primero para saber si
     *  le queda cerca. */
    lugar: text("lugar").notNull(),

    /** La línea corta que acompaña al título: "8 etiquetas a ciegas". */
    detalle: text("detalle"),

    /** En centavos: guardar plata en float termina en $8999.9999999. */
    precioCentavos: integer("precio_centavos").notNull(),

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
