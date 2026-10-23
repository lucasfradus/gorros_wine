"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Aviso, type FormState } from "../form-ui";
import { sincronizarAction } from "./actions";
import styles from "../../admin.module.css";
import propios from "./facturacion.module.css";

const INICIAL: FormState = {};

/** "Actualizar": trae de MP los cobros de los últimos días. */
export function SyncForm() {
  const [state, action] = useActionState(sincronizarAction, INICIAL);

  return (
    <form action={action} className={propios.sync}>
      <label className={propios.syncCampo}>
        <span className={styles.label}>Traer los últimos</span>
        <select name="dias" defaultValue="7" className={styles.select}>
          <option value="1">1 día</option>
          <option value="7">7 días</option>
          <option value="30">30 días</option>
          <option value="90">90 días</option>
        </select>
      </label>
      <Boton />
      <Aviso state={state} />
    </form>
  );
}

function Boton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${styles.btn} ${styles.btnSmall}`}
    >
      {pending ? "Consultando Mercado Pago…" : "Actualizar"}
    </button>
  );
}
