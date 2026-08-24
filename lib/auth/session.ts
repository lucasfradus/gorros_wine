import { createHash, randomBytes } from "node:crypto";
import { and, eq, lt, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, users, type PublicUser } from "@/lib/db/schema";

export const SESSION_COOKIE = "gw_session";

/**
 * Duración de la sesión: 30 días, absolutos.
 *
 * Sin renovación deslizante a propósito. Renovar exige reescribir la cookie
 * en cada request, y en Next las cookies sólo se pueden tocar desde una
 * Server Action o un Route Handler — nunca desde el layout que hace la
 * verificación. Un vencimiento fijo es predecible y se explica en una línea:
 * cada 30 días hay que volver a ingresar.
 */
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

/** Guardamos el hash del token, nunca el token. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface SessionMeta {
  userAgent?: string | null;
  ip?: string | null;
}

/** Crea la sesión y devuelve el token en claro — el único momento en que existe. */
export async function createSession(
  userId: string,
  meta: SessionMeta = {},
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(sessions).values({
    id: hashToken(token),
    userId,
    expiresAt,
    userAgent: meta.userAgent ?? null,
    ip: meta.ip ?? null,
  });

  return { token, expiresAt };
}

/**
 * Valida el token contra la base. Devuelve el usuario sin el hash de la
 * contraseña, o null si la sesión no existe, venció, o el usuario quedó
 * desactivado desde que ingresó.
 */
export async function validateSessionToken(
  token: string,
): Promise<PublicUser | null> {
  const id = hashToken(token);

  const [row] = await db
    .select({
      user: users,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, id))
    .limit(1);

  if (!row) return null;

  if (row.expiresAt.getTime() <= Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }

  // Desactivar a alguien lo tiene que echar ya, no cuando venza su sesión.
  if (!row.user.isActive) {
    await db.delete(sessions).where(eq(sessions.userId, row.user.id));
    return null;
  }

  const { passwordHash: _omit, ...publicUser } = row.user;
  return publicUser;
}

export async function invalidateSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

/**
 * Cierra las sesiones de un usuario. Con `exceptToken` deja viva la del que
 * está ejecutando la acción, que es lo que se quiere al cambiar la propia
 * contraseña: se cierran las otras pantallas, no la de uno.
 */
export async function invalidateAllSessions(
  userId: string,
  exceptToken?: string,
): Promise<void> {
  const filtro = exceptToken
    ? and(eq(sessions.userId, userId), ne(sessions.id, hashToken(exceptToken)))
    : eq(sessions.userId, userId);

  await db.delete(sessions).where(filtro);
}

/** Limpia sesiones vencidas. Se llama al ingresar; no hace falta un cron. */
export async function pruneExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
