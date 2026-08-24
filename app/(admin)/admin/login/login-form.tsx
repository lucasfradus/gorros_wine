"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction, type LoginState } from "./actions";
import styles from "../admin.module.css";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState<LoginState, FormData>(
    loginAction,
    {},
  );

  return (
    <form action={formAction} className={styles.form}>
      {state.error ? (
        <p className={`${styles.alert} ${styles.alertError}`} role="alert">
          {state.error}
        </p>
      ) : null}

      <input type="hidden" name="next" value={next ?? ""} />

      <div className={styles.field}>
        <label className={styles.label} htmlFor="email">
          Mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          className={styles.input}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="password">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={styles.input}
        />
      </div>

      <Submit />
    </form>
  );
}

function Submit() {
  // useFormStatus lee el estado del <form> que lo contiene: sirve para
  // deshabilitar el botón mientras el servidor responde, sin estado propio.
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${styles.btn} ${styles.btnPrimary} ${styles.btnWide}`}
    >
      {pending ? "Entrando…" : "Ingresar"}
    </button>
  );
}
