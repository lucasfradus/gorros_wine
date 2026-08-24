"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { UserRole } from "@/lib/db/schema";
import { ROLE_DESCRIPTION, ROLE_LABEL } from "@/lib/auth/permissions";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/constants";
import type { UserFormState } from "./actions";
import styles from "../../admin.module.css";

type Accion = (
  prev: UserFormState,
  formData: FormData,
) => Promise<UserFormState>;

function Aviso({ state }: { state: UserFormState }) {
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

function Submit({
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

/** Alta y edición de datos. La misma pantalla, distinto action. */
export function UserForm({
  action,
  roles,
  defaults,
  withPassword = false,
  submitLabel,
  lockRole = false,
}: {
  action: Accion;
  roles: UserRole[];
  defaults?: { id?: string; name?: string; email?: string; role?: UserRole };
  withPassword?: boolean;
  submitLabel: string;
  lockRole?: boolean;
}) {
  const [state, formAction] = useActionState<UserFormState, FormData>(
    action,
    {},
  );

  const rolActual = defaults?.role ?? "editor";

  return (
    <form action={formAction} className={styles.form}>
      <Aviso state={state} />

      {defaults?.id ? (
        <input type="hidden" name="id" value={defaults.id} />
      ) : null}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="name">
          Nombre
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={defaults?.name}
          className={styles.input}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="email">
          Mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="off"
          defaultValue={defaults?.email}
          className={styles.input}
        />
        <span className={styles.hint}>Es con lo que ingresa al panel.</span>
      </div>

      {withPassword ? (
        <div className={styles.field}>
          <label className={styles.label} htmlFor="password">
            Contraseña inicial
          </label>
          <input
            id="password"
            name="password"
            type="text"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="off"
            className={styles.input}
          />
          <span className={styles.hint}>
            Mínimo {MIN_PASSWORD_LENGTH} caracteres. Se muestra en claro a
            propósito: la tenés que copiar y pasársela a la persona, que
            después la cambia desde Mi cuenta.
          </span>
        </div>
      ) : null}

      <div className={styles.field}>
        <span className={styles.label}>Rol</span>

        {lockRole ? (
          <>
            <input type="hidden" name="role" value={rolActual} />
            <span className={styles.hint}>
              {ROLE_LABEL[rolActual]} — nadie puede cambiarse el rol a sí mismo.
            </span>
          </>
        ) : (
          <div className={styles.radioGroup}>
            {roles.map((r) => (
              <label key={r} className={styles.radioRow}>
                <input
                  type="radio"
                  name="role"
                  value={r}
                  defaultChecked={r === rolActual}
                  required
                />
                <span>
                  <span className={styles.radioName}>{ROLE_LABEL[r]}</span>
                  <span className={styles.radioDesc}>
                    {ROLE_DESCRIPTION[r]}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className={styles.btnRow}>
        <Submit>{submitLabel}</Submit>
      </div>
    </form>
  );
}

/** Le fija una contraseña nueva a otra persona. */
export function PasswordForm({
  action,
  userId,
}: {
  action: Accion;
  userId: string;
}) {
  const [state, formAction] = useActionState<UserFormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className={styles.form}>
      <Aviso state={state} />
      <input type="hidden" name="id" value={userId} />

      <div className={styles.field}>
        <label className={styles.label} htmlFor="newPassword">
          Contraseña nueva
        </label>
        <input
          id="newPassword"
          name="password"
          type="text"
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="off"
          className={styles.input}
        />
        <span className={styles.hint}>
          Al guardarla se cierran todas las sesiones abiertas de esa persona.
        </span>
      </div>

      <div className={styles.btnRow}>
        <Submit variant="plain">Cambiar contraseña</Submit>
      </div>
    </form>
  );
}

/** Activa o desactiva. No hay borrado: ver el comentario de la página. */
export function ToggleActiveForm({
  action,
  userId,
  isActive,
}: {
  action: Accion;
  userId: string;
  isActive: boolean;
}) {
  const [state, formAction] = useActionState<UserFormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className={styles.form}>
      <Aviso state={state} />
      <input type="hidden" name="id" value={userId} />
      <p className={styles.hint} style={{ margin: 0 }}>
        {isActive
          ? "Desactivar corta el acceso al instante y cierra sus sesiones abiertas. Los datos y el historial quedan."
          : "Reactivar le devuelve el acceso con la misma contraseña que tenía."}
      </p>
      <div className={styles.btnRow}>
        <Submit variant="plain">{isActive ? "Desactivar" : "Reactivar"}</Submit>
      </div>
    </form>
  );
}
