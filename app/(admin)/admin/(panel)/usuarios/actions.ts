"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, count, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users, userRole, type PublicUser } from "@/lib/db/schema";
import {
  hashPassword,
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
} from "@/lib/auth/password";
import { invalidateAllSessions } from "@/lib/auth/session";
import { canAssignRole, canEditUser, requireUserManager } from "@/lib/auth";

export interface UserFormState {
  error?: string;
  ok?: string;
}

const nombre = z.string().trim().min(2, "El nombre es muy corto.");
const contrasena = z
  .string()
  .min(
    MIN_PASSWORD_LENGTH,
    `La contraseña tiene que tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
  );

/**
 * ¿Es el último dueño activo que queda?
 *
 * Sin esta comprobación el sistema se puede quedar sin nadie que pueda
 * nombrar dueños: un `owner` se degrada a editor y ya no hay forma de volver
 * atrás desde el panel.
 *
 * Nota honesta: es un chequeo leer-y-después-escribir. Con dos dueños
 * degradándose en el mismo instante los dos podrían pasar. Con un panel de
 * dos o tres personas no es un riesgo real; si algún día lo fuera, hay que
 * hacerlo dentro de una transacción con `SELECT ... FOR UPDATE`.
 */
async function esUltimoOwnerActivo(userId: string): Promise<boolean> {
  const [otros] = await db
    .select({ n: count() })
    .from(users)
    .where(
      and(
        eq(users.role, "owner"),
        eq(users.isActive, true),
        ne(users.id, userId),
      ),
    );

  return otros.n === 0;
}

async function buscarUsuario(id: string) {
  const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return u ?? null;
}

/** Verificación común a todas las acciones sobre un usuario ajeno. */
async function autorizarSobre(
  id: string,
): Promise<
  { error: string } | { actor: PublicUser; objetivo: typeof users.$inferSelect }
> {
  const actor = await requireUserManager();
  const objetivo = await buscarUsuario(id);

  if (!objetivo) return { error: "Ese usuario ya no existe." };
  if (!canEditUser(actor, objetivo)) {
    return { error: "No tenés permiso para modificar a este usuario." };
  }

  return { actor, objetivo };
}

// ---------------------------------------------------------------- crear

const crearSchema = z.object({
  name: nombre,
  email: z.email("Escribí un mail válido."),
  role: z.enum(userRole.enumValues),
  password: contrasena,
});

export async function createUserAction(
  _prev: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  const actor = await requireUserManager();

  const parsed = crearSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    password: formData.get("password"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (!canAssignRole(actor, parsed.data.role)) {
    return { error: "No podés asignar ese rol." };
  }

  const email = normalizeEmail(parsed.data.email);

  const [existente] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existente) return { error: "Ya hay una cuenta con ese mail." };

  await db.insert(users).values({
    name: parsed.data.name,
    email,
    role: parsed.data.role,
    passwordHash: await hashPassword(parsed.data.password),
  });

  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios");
}

// ---------------------------------------------------------------- editar

const editarSchema = z.object({
  id: z.uuid(),
  name: nombre,
  email: z.email("Escribí un mail válido."),
  role: z.enum(userRole.enumValues),
});

export async function updateUserAction(
  _prev: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  const parsed = editarSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const auth = await autorizarSobre(parsed.data.id);
  if ("error" in auth) return auth;
  const { actor, objetivo } = auth;

  const cambiaRol = parsed.data.role !== objetivo.role;

  if (cambiaRol) {
    // Cambiarse el rol a uno mismo es la vía más corta a quedarse afuera.
    if (objetivo.id === actor.id) {
      return { error: "No podés cambiar tu propio rol. Pedíselo a otro dueño." };
    }
    if (!canAssignRole(actor, parsed.data.role)) {
      return { error: "No podés asignar ese rol." };
    }
    if (
      objetivo.role === "owner" &&
      objetivo.isActive &&
      (await esUltimoOwnerActivo(objetivo.id))
    ) {
      return {
        error:
          "Es el único dueño activo. Nombrá otro dueño antes de cambiarle el rol.",
      };
    }
  }

  const email = normalizeEmail(parsed.data.email);

  if (email !== objetivo.email) {
    const [existente] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existente) return { error: "Ya hay otra cuenta con ese mail." };
  }

  await db
    .update(users)
    .set({
      name: parsed.data.name,
      email,
      role: parsed.data.role,
      updatedAt: new Date(),
    })
    .where(eq(users.id, objetivo.id));

  revalidatePath("/admin/usuarios");
  revalidatePath(`/admin/usuarios/${objetivo.id}`);
  return { ok: "Cambios guardados." };
}

// ------------------------------------------------------- cambiar contraseña

const passwordSchema = z.object({
  id: z.uuid(),
  password: contrasena,
});

export async function setPasswordAction(
  _prev: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  const parsed = passwordSchema.safeParse({
    id: formData.get("id"),
    password: formData.get("password"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const auth = await autorizarSobre(parsed.data.id);
  if ("error" in auth) return auth;
  const { objetivo } = auth;

  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(parsed.data.password),
      failedAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, objetivo.id));

  // Cambiarle la contraseña a alguien lo saca de todos lados. Es el gesto que
  // se hace cuando se sospecha que la cuenta está comprometida.
  await invalidateAllSessions(objetivo.id);

  revalidatePath(`/admin/usuarios/${objetivo.id}`);
  return { ok: "Contraseña actualizada. Se cerraron sus sesiones abiertas." };
}

// -------------------------------------------------------- activar/desactivar

export async function toggleActiveAction(
  _prev: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Usuario inválido." };

  const auth = await autorizarSobre(id.data);
  if ("error" in auth) return auth;
  const { actor, objetivo } = auth;

  if (objetivo.id === actor.id) {
    return { error: "No podés desactivar tu propia cuenta." };
  }

  const desactivando = objetivo.isActive;

  if (
    desactivando &&
    objetivo.role === "owner" &&
    (await esUltimoOwnerActivo(objetivo.id))
  ) {
    return { error: "Es el único dueño activo. No se puede desactivar." };
  }

  await db
    .update(users)
    .set({ isActive: !objetivo.isActive, updatedAt: new Date() })
    .where(eq(users.id, objetivo.id));

  // Desactivar tiene que echar a la persona en el acto, no cuando venza su
  // sesión. `validateSessionToken` además vuelve a mirar `isActive`.
  if (desactivando) await invalidateAllSessions(objetivo.id);

  revalidatePath("/admin/usuarios");
  revalidatePath(`/admin/usuarios/${objetivo.id}`);

  return {
    ok: desactivando
      ? "Usuario desactivado. Ya no puede ingresar."
      : "Usuario reactivado.",
  };
}
