"use client";

import styles from "../../../../admin.module.css";

/** El PDF lo arma el navegador: "Guardar como PDF" en el diálogo de impresión. */
export function Imprimir() {
  return (
    <button type="button" onClick={() => window.print()} className={`${styles.btn} ${styles.btnSmall} ${styles.btnPrimary}`}>
      Imprimir / Guardar PDF
    </button>
  );
}
