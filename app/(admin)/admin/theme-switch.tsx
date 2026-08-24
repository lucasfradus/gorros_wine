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
    <form action={setThemeAction} className={styles.themeForm}>
      <span className={styles.themeLabel} id="modo-visual">
        Modo
      </span>
      <div className={styles.themeSwitch} role="group" aria-labelledby="modo-visual">
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
