"use client";

import styles from "./admin/admin.module.css";

/**
 * Casi siempre que el panel explota es porque Postgres no está levantado.
 * Vale más un mensaje que diga qué hacer que una pantalla de error genérica.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className={`${styles.themed} ${styles.loginWrap}`}>
      <div className={styles.loginCard}>
        <div className={styles.loginBrand}>
          <span className={styles.loginLogo}>Gorros Wine</span>
          <span className={styles.loginKicker}>Algo falló</span>
        </div>

        <p className={`${styles.alert} ${styles.alertError}`}>
          No se pudo cargar el panel. Lo más habitual es que la base de datos
          no esté corriendo: probá <code>npm run db:up</code> y volvé a
          intentar.
        </p>

        {error.digest ? (
          <p className={styles.hint} style={{ marginTop: 14 }}>
            Referencia del error: {error.digest}
          </p>
        ) : null}

        <div className={styles.btnRow} style={{ marginTop: 20 }}>
          <button
            type="button"
            onClick={reset}
            className={`${styles.btn} ${styles.btnPrimary} ${styles.btnWide}`}
          >
            Reintentar
          </button>
        </div>
      </div>
    </div>
  );
}
