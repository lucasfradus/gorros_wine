"use client";

import { useState } from "react";
import { Isotipo } from "./isotipo";
import styles from "./age-gate.module.css";

export const AGE_KEY = "gw-age-ok";

/**
 * Script que corre antes de pintar: si ya confirmó la edad, marca el <html>
 * y el CSS oculta la pantalla sin que llegue a verse. Va al principio del
 * <body> para que se ejecute antes de que se pinte el resto.
 */
export const ageGateScript = `try{if(localStorage.getItem(${JSON.stringify(AGE_KEY)})==="1")document.documentElement.setAttribute("data-age-ok","1")}catch(e){}`;

export function AgeGate() {
  const [confirmed, setConfirmed] = useState(false);

  function confirm() {
    try {
      localStorage.setItem(AGE_KEY, "1");
    } catch {
      // Modo incógnito o storage bloqueado: sigue igual, sólo no persiste.
    }
    document.documentElement.setAttribute("data-age-ok", "1");
    setConfirmed(true);
  }

  if (confirmed) return null;

  return (
    // js-age-gate es global a propósito: el CSS de globals.css lo oculta
    // según el atributo del <html>, y una clase de módulo iría con hash.
    <div
      className={`js-age-gate ${styles.gate}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-title"
    >
      <div className={styles.texture} aria-hidden="true" />

      <div className={styles.inner}>
        <p className={styles.logo}>
          <Isotipo size={72} className={styles.logoMark} />
          <span>GORROS WINE</span>
        </p>
        <p className={styles.eyebrow}>Verificación de edad</p>

        <h1 id="age-title" className={styles.title}>
          La venta de bebidas alcohólicas está prohibida para menores de 18
          años.
        </h1>

        <p className={styles.body}>
          Para ingresar al sitio, confirmá que tenés la edad legal para consumir
          alcohol en Argentina.
        </p>

        <button
          type="button"
          className="btn btnGold"
          onClick={confirm}
          autoFocus
        >
          Soy mayor de 18 años
        </button>

        <p className={styles.moderation}>Beber con moderación</p>
      </div>
    </div>
  );
}
