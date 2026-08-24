import { cookies } from "next/headers";
import { DEFAULT_THEME, isTheme, THEME_COOKIE, type Theme } from "./theme";

/**
 * Lee el modo elegido. Va en su propio módulo porque importa `next/headers`:
 * si viviera en `lib/theme.ts`, ningún componente cliente podría usar las
 * etiquetas sin romper el build.
 */
export async function getTheme(): Promise<Theme> {
  const valor = (await cookies()).get(THEME_COOKIE)?.value;
  return isTheme(valor) ? valor : DEFAULT_THEME;
}
