"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSessionToken, requireUser } from "@/lib/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/constants";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { invalidateAllSessions } from "@/lib/auth/session";

export interface CuentaState {
  error?: string;
  ok?: string;
}

const schema = z
  .object({
    current: z.string().min(1, "Escribí tu contraseña actual."),
    next: z
      .string()
      .min(
        MIN_PASSWORD_LENGTH,
        `La contraseña nueva tiene que tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
      ),
  })
  .refine((d) => d.current !== d.next, {
    message: "La contraseña nueva tiene que ser distinta de la actual.",
  });

export async function changeOwnPasswordAction(
  _prev: CuentaState,
  formData: FormData,
): Promise<CuentaState> {
  const actor = await requireUser();

  const parsed = schema.safeParse({
    current: formData.get("current"),
    next: formData.get("next"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // `requireUser` devuelve el usuario sin el hash a propósito, así que para
  // comparar la contraseña actual hay que ir a buscar la fila.
  const [fila] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, actor.id))
    .limit(1);

  if (!fila) return { error: "Tu cuenta ya no existe." };

  // Pedir la actual es lo que evita que alguien que encuentre la sesión
  // abierta en una computadora prestada se quede con la cuenta.
  if (!(await verifyPassword(parsed.data.current, fila.passwordHash))) {
    return { error: "La contraseña actual no es correcta." };
  }

  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(parsed.data.next),
      failedAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, actor.id));

  // Se cierran las demás sesiones pero no ésta: cambiar la contraseña no
  // debería echarte de la pantalla donde la estás cambiando.
  const token = await getSessionToken();
  await invalidateAllSessions(actor.id, token ?? undefined);

  return {
    ok: "Contraseña actualizada. Se cerraron tus otras sesiones abiertas.",
  };
}
