import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
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
