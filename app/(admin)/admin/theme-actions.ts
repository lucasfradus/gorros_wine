"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { isTheme, THEME_COOKIE } from "@/lib/theme";

const UN_ANIO = 60 * 60 * 24 * 365;

/**
 * Cambia el modo visual. No pide sesión: es una preferencia de visualización
 * del navegador, no un dato del negocio, y la pantalla de ingreso también la
 * usa. Lo único que se valida es que el valor sea uno de los tres modos.
 */
export async function setThemeAction(formData: FormData) {
  const elegido = formData.get("theme");
  if (!isTheme(elegido)) return;

  const store = await cookies();
  store.set(THEME_COOKIE, elegido, {
    path: "/",
    maxAge: UN_ANIO,
    sameSite: "lax",
    // Nadie del lado del cliente necesita leerla: el modo lo aplica el
    // servidor al renderizar.
    httpOnly: true,
  });

  // El modo lo pinta el layout, así que hay que revalidarlo entero y no sólo
  // la página donde se apretó el botón.
  revalidatePath("/admin", "layout");
}
