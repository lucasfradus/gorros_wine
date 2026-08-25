"use client";

import { useFormStatus } from "react-dom";
import styles from "../admin.module.css";

/**
 * Las dos piezas que repite todo formulario del panel: el cartel de resultado
 * y el botón que se bloquea mientras se envía.
 *
 * Viven acá y no en cada sección porque son tres secciones con el mismo
 * formulario —Usuarios, Bodegas, Productos— y tres copias del mismo botón se
 * desincronizan a la primera corrección de texto.
 */

/** La forma que devuelven todas las Server Actions del panel. */
export interface FormState {
  error?: string;
  ok?: string;
}

export type FormAction = (
  prev: FormState,
  formData: FormData,
) => Promise<FormState>;

export function Aviso({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <p className={`${styles.alert} ${styles.alertError}`} role="alert">
        {state.error}
      </p>
    );
  }
  if (state.ok) {
    return (
      <p className={`${styles.alert} ${styles.alertOk}`} role="status">
        {state.ok}
      </p>
    );
  }
  return null;
}

export function Submit({
  children,
  variant = "primary",
}: {
  children: string;
  variant?: "primary" | "plain";
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${styles.btn} ${variant === "primary" ? styles.btnPrimary : ""}`}
    >
      {pending ? "Guardando…" : children}
    </button>
  );
}
