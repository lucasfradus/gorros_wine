"use server";

import { redirect } from "next/navigation";
import { clearSessionCookie, getSessionToken } from "@/lib/auth";
import { invalidateSession } from "@/lib/auth/session";

/**
 * Salir borra la sesión de la base además de la cookie. Si sólo se borrara la
 * cookie, el token seguiría siendo válido para quien lo hubiera copiado.
 */
export async function logoutAction() {
  const token = await getSessionToken();
  if (token) await invalidateSession(token);
  await clearSessionCookie();
  redirect("/admin/login");
}
