"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/constants";
import { changeOwnPasswordAction, type CuentaState } from "./actions";
import styles from "../../admin.module.css";

export function ChangePasswordForm() {
  const [state, formAction] = useActionState<CuentaState, FormData>(
    changeOwnPasswordAction,
    {},
  );

  return (
    <form action={formAction} className={styles.form}>
      {state.error ? (
        <p className={`${styles.alert} ${styles.alertError}`} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className={`${styles.alert} ${styles.alertOk}`} role="status">
          {state.ok}
        </p>
      ) : null}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="current">
          Contraseña actual
        </label>
        <input
          id="current"
          name="current"
          type="password"
          autoComplete="current-password"
          required
          className={styles.input}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="next">
          Contraseña nueva
        </label>
        <input
          id="next"
          name="next"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
          className={styles.input}
        />
        <span className={styles.hint}>
          Mínimo {MIN_PASSWORD_LENGTH} caracteres.
        </span>
      </div>

      <div className={styles.btnRow}>
        <Submit />
      </div>
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${styles.btn} ${styles.btnPrimary}`}
    >
      {pending ? "Guardando…" : "Cambiar contraseña"}
    </button>
  );
}
