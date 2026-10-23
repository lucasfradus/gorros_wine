"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Aviso, type FormAction, type FormState } from "../form-ui";
import styles from "../../admin.module.css";

const INICIAL: FormState = {};

/**
 * Un botón que dispara una action sobre un comprobante y muestra el resultado
 * al lado. `confirmar` pide confirmación antes: anular emite un comprobante
 * fiscal que no se deshace.
 */
export function AccionComprobante({
  action,
  id,
  label,
  pendiente,
  confirmar,
  peligro = false,
}: {
  action: FormAction;
  id: string;
  label: string;
  pendiente: string;
  confirmar?: string;
  peligro?: boolean;
}) {
  const [state, formAction] = useActionState(action, INICIAL);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirmar && !window.confirm(confirmar)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Boton label={label} pendiente={pendiente} peligro={peligro} />
      <Aviso state={state} />
    </form>
  );
}

function Boton({ label, pendiente, peligro }: { label: string; pendiente: string; peligro: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${styles.btn} ${styles.btnSmall} ${peligro ? styles.btnDanger : ""}`}
    >
      {pending ? pendiente : label}
    </button>
  );
}
