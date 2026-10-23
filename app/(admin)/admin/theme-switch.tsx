import { THEME_LABEL, THEME_TITLE, THEMES, type Theme } from "@/lib/theme";
import { setThemeAction } from "./theme-actions";
import styles from "./admin.module.css";

/**
 * Selector de modo. Es un componente de servidor: tres botones de envío en un
 * mismo formulario, sin una línea de JavaScript propio. Funciona igual con el
 * JS deshabilitado, y con JS React lo resuelve sin recargar la página.
 */
export function ThemeSwitch({ current }: { current: Theme }) {
  return (
    <form action={setThemeAction}>
      {/* Los tres nombres (Claro, Oscuro, Sistema) se explican solos a la
          vista; el rótulo queda para el lector de pantalla. */}
      <div className={styles.themeSwitch} role="group" aria-label="Modo visual">
        {THEMES.map((t) => (
          <button
            key={t}
            type="submit"
            name="theme"
            value={t}
            title={THEME_TITLE[t]}
            aria-pressed={current === t}
            className={`${styles.themeBtn} ${
              current === t ? styles.themeBtnOn : ""
            }`}
          >
            {THEME_LABEL[t]}
          </button>
        ))}
      </div>
    </form>
  );
}
