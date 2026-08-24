/**
 * Modo visual del panel. Módulo sin dependencias de servidor a propósito: lo
 * importan tanto el layout como los componentes, y no tiene que arrastrar
 * `next/headers` al bundle.
 *
 * La preferencia vive en una cookie y no en la tabla `users`. Tres razones:
 * el servidor la lee antes de renderizar, así el modo correcto se pinta de
 * entrada y no hay parpadeo; funciona también en la pantalla de ingreso,
 * donde todavía no hay usuario; y no cuesta una migración ni una consulta.
 * Lo que se pierde es que la elección no viaja entre navegadores, que para
 * una preferencia de visualización es aceptable.
 */
export const THEME_COOKIE = "gw-theme";

export const THEMES = ["dark", "light", "system"] as const;

export type Theme = (typeof THEMES)[number];

/** Sin cookie, oscuro: es el modo con el que nació el panel. */
export const DEFAULT_THEME: Theme = "dark";

export const THEME_LABEL: Record<Theme, string> = {
  dark: "Oscuro",
  light: "Claro",
  system: "Auto",
};

export const THEME_TITLE: Record<Theme, string> = {
  dark: "Modo oscuro",
  light: "Modo claro",
  system: "Seguir el modo del sistema",
};

export function isTheme(value: unknown): value is Theme {
  return (
    typeof value === "string" && (THEMES as readonly string[]).includes(value)
  );
}
