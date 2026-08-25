import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { PublicUser } from "@/lib/db/schema";
import { SESSION_COOKIE, validateSessionToken } from "./session";
import { canEditContent, canManageUsers } from "./permissions";

export * from "./permissions";
export { SESSION_COOKIE };

/**
 * Punto único de verdad sobre quién está conectado.
 *
 * Todo lo que lea o escriba datos del panel arranca por acá — páginas y
 * Server Actions por igual. La verificación no se delega al middleware: el
 * middleware sólo redirige rápido, y no alcanza como control de acceso
 * porque no consulta la base.
 *
 * `cache()` de React lo memoriza por request, así el layout y la página no
 * pegan dos veces a la base por lo mismo.
 */
export const getCurrentUser = cache(async (): Promise<PublicUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return validateSessionToken(token);
});

export async function getSessionToken(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

/** Exige sesión. Si no hay, manda a ingresar y no sigue. */
export async function requireUser(next?: string): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(next ? `/admin/login?next=${encodeURIComponent(next)}` : "/admin/login");
  }
  return user;
}

/** Exige sesión con permiso sobre usuarios. */
export async function requireUserManager(): Promise<PublicUser> {
  const user = await requireUser();
  if (!canManageUsers(user)) redirect("/admin");
  return user;
}

/** Exige sesión con permiso sobre el contenido del sitio. */
export async function requireContentEditor(): Promise<PublicUser> {
  const user = await requireUser();
  if (!canEditContent(user)) redirect("/admin");
  return user;
}

export async function setSessionCookie(
  token: string,
  expiresAt: Date,
): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true, // invisible para JavaScript: un XSS no se lleva la sesión
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // freno a CSRF, y deja pasar la navegación normal
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * Valida el `?next=` para no habilitar un redirect abierto: sólo se acepta
 * una ruta interna del panel, nunca una URL a otro dominio.
 */
export function safeNext(next: string | undefined | null): string {
  if (!next) return "/admin";
  if (!next.startsWith("/admin")) return "/admin";
  if (next.startsWith("//")) return "/admin";
  if (next.startsWith("/admin/login")) return "/admin";
  return next;
}
