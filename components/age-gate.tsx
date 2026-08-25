"use client";

import { useState } from "react";
import { Isotipo } from "./isotipo";
import { Lineas } from "./rich-text";
import styles from "./age-gate.module.css";

export const AGE_KEY = "gw-age-ok";

/**
 * Script que corre antes de pintar: si ya confirmó la edad, marca el <html>
 * y el CSS oculta la pantalla sin que llegue a verse. Va al principio del
 * <body> para que se ejecute antes de que se pinte el resto.
 */
export const ageGateScript = `try{if(localStorage.getItem(${JSON.stringify(AGE_KEY)})==="1")document.documentElement.setAttribute("data-age-ok","1")}catch(e){}`;

export interface AgeGateCopy {
  eyebrow: string;
  titulo: string;
  body: string;
  cta: string;
  pie: string;
}

/**
 * El copy llega por props y no de `getContent()`: esto es un componente de
 * cliente —necesita `localStorage` y estado— y desde el navegador no se puede
 * leer la base. Lo trae el layout de la tienda, que sí corre en el servidor.
 */
export function AgeGate({ copy }: { copy: AgeGateCopy }) {
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
        <p className={styles.eyebrow}>{copy.eyebrow}</p>

        <h1 id="age-title" className={styles.title}>
          <Lineas texto={copy.titulo} />
        </h1>

        <p className={styles.body}>{copy.body}</p>

        <button
          type="button"
          className="btn btnGold"
          onClick={confirm}
          autoFocus
        >
          {copy.cta}
        </button>

        <p className={styles.moderation}>{copy.pie}</p>
      </div>
    </div>
  );
}
