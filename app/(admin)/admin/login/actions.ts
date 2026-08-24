"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { burnTime, normalizeEmail, verifyPassword } from "@/lib/auth/password";
import { createSession, pruneExpiredSessions } from "@/lib/auth/session";
import { safeNext, setSessionCookie } from "@/lib/auth";

/** Tras 5 intentos fallidos la cuenta queda trabada 15 minutos. */
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

/**
 * Mismo mensaje para "ese mail no existe" y "esa contraseña está mal". Decir
 * cuál de las dos falló le regala a un atacante la lista de mails válidos.
 */
const CREDENCIALES_INVALIDAS = "Mail o contraseña incorrectos.";

export interface LoginState {
  error?: string;
}

const loginSchema = z.object({
  email: z.email("Escribí un mail válido."),
  password: z.string().min(1, "Escribí tu contraseña."),
});

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const email = normalizeEmail(parsed.data.email);
  const { password } = parsed.data;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    // Igual gastamos el tiempo de un bcrypt para no delatar por demora que
    // el mail no está dado de alta.
    await burnTime(password);
    return { error: CREDENCIALES_INVALIDAS };
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    const minutos = Math.ceil(
      (user.lockedUntil.getTime() - Date.now()) / 60_000,
    );
    return {
      error: `Demasiados intentos fallidos. Probá de nuevo en ${minutos} ${
        minutos === 1 ? "minuto" : "minutos"
      }.`,
    };
  }

  if (!user.isActive) {
    return {
      error: "Tu cuenta está desactivada. Pedile a un administrador que la reactive.",
    };
  }

  const ok = await verifyPassword(password, user.passwordHash);

  if (!ok) {
    const intentos = user.failedAttempts + 1;
    const traba = intentos >= MAX_ATTEMPTS;

    await db
      .update(users)
      .set({
        failedAttempts: traba ? 0 : intentos,
        lockedUntil: traba
          ? new Date(Date.now() + LOCK_MINUTES * 60_000)
          : user.lockedUntil,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return {
      error: traba
        ? `Demasiados intentos fallidos. La cuenta queda trabada ${LOCK_MINUTES} minutos.`
        : CREDENCIALES_INVALIDAS,
    };
  }

  await db
    .update(users)
    .set({
      failedAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  // Barrido oportunista: evita un cron sólo para limpiar sesiones vencidas.
  await pruneExpiredSessions();

  const h = await headers();
  const { token, expiresAt } = await createSession(user.id, {
    userAgent: h.get("user-agent"),
    // El primero de la lista es el cliente; el resto son los proxies.
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });

  await setSessionCookie(token, expiresAt);

  // Fuera de cualquier try: redirect() funciona lanzando una excepción que
  // Next intercepta, así que atraparla rompería la redirección.
  redirect(safeNext(String(formData.get("next") ?? "")));
}
