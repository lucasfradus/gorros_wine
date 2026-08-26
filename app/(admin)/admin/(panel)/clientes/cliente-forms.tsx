"use client";

import { useActionState } from "react";
import type { ClienteFormState } from "./actions";
import { Aviso, Submit, type FormAction } from "../form-ui";
import styles from "../../admin.module.css";
import propios from "./clientes.module.css";

function Campo({
  name,
  label,
  hint,
  defaultValue,
  type = "text",
  required = false,
  maxLength,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultValue?: string | null;
  type?: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        maxLength={maxLength}
        defaultValue={defaultValue ?? ""}
        autoComplete="off"
        className={styles.input}
      />
      {hint ? <span className={styles.hint}>{hint}</span> : null}
    </div>
  );
}

export interface ClienteDefaults {
  id?: string;
  nombre?: string;
  apodo?: string | null;
  telefono?: string | null;
  email?: string | null;
  documento?: string | null;
  razonSocial?: string | null;
  direccion?: string | null;
  notas?: string | null;
  cuentaCorriente?: boolean;
  limiteArs?: string;
  limiteUsd?: string;
}

/**
 * Alta y edición: la misma pantalla con distinta action.
 *
 * `puedeVerPlata` no es cosmético. Cuando es `false` los campos de límite y de
 * saldo inicial no se dibujan, y la action además los ignora — lo que de
 * verdad frena a un editor es lo segundo.
 */
export function ClienteForm({
  action,
  defaults,
  submitLabel,
  puedeVerPlata,
  conSaldoInicial = false,
}: {
  action: FormAction;
  defaults?: ClienteDefaults;
  submitLabel: string;
  puedeVerPlata: boolean;
  conSaldoInicial?: boolean;
}) {
  const [state, formAction] = useActionState<ClienteFormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className={styles.form}>
      <Aviso state={state} />

      {defaults?.id ? (
        <input type="hidden" name="id" value={defaults.id} />
      ) : null}

      <Campo
        name="nombre"
        label="Nombre"
        required
        maxLength={160}
        defaultValue={defaults?.nombre}
      />
      <Campo
        name="apodo"
        label="Apodo o negocio"
        hint="Cómo lo tenés agendado: “Pepe el del restaurante”. Se busca por acá igual que por el nombre."
        maxLength={120}
        defaultValue={defaults?.apodo}
      />
      <Campo
        name="telefono"
        label="WhatsApp"
        type="tel"
        maxLength={60}
        defaultValue={defaults?.telefono}
      />
      <Campo
        name="email"
        label="Mail"
        type="email"
        hint="Opcional, pero no se puede repetir entre clientes."
        defaultValue={defaults?.email}
      />
      <Campo
        name="documento"
        label="CUIT o DNI"
        maxLength={40}
        defaultValue={defaults?.documento}
      />
      <Campo
        name="razonSocial"
        label="Razón social"
        maxLength={160}
        defaultValue={defaults?.razonSocial}
      />
      <Campo
        name="direccion"
        label="Dirección de entrega"
        maxLength={240}
        defaultValue={defaults?.direccion}
      />

      <div className={styles.field}>
        <label className={styles.label} htmlFor="notas">
          Notas internas
        </label>
        <textarea
          id="notas"
          name="notas"
          rows={3}
          maxLength={2000}
          defaultValue={defaults?.notas ?? ""}
          className={styles.input}
        />
        <span className={styles.hint}>
          Para vos, no las ve el cliente: “paga a fin de mes”, “prefiere tintos”.
        </span>
      </div>

      <div className={styles.field}>
        <label className={propios.check}>
          <input
            type="checkbox"
            name="cuentaCorriente"
            defaultChecked={defaults?.cuentaCorriente ?? false}
          />
          <span>
            <span className={styles.radioName}>Cuenta corriente</span>
            <span className={styles.radioDesc}>
              Se puede llevar mercadería y saldar después. Sin esto, el cliente
              igual tiene ficha y podés anotarle movimientos, pero queda marcado
              como que no le fiás.
            </span>
          </span>
        </label>
      </div>

      {puedeVerPlata ? (
        <fieldset className={propios.grupo}>
          <legend className={styles.label}>Límite de crédito</legend>
          <p className={styles.hint}>
            Vacío es sin límite. Es un aviso, no una traba: si se pasa te lo
            marca y vos decidís. Va por moneda porque no hay un tipo de cambio
            de referencia con el que sumar las dos.
          </p>
          <div className={propios.dosColumnas}>
            <Campo
              name="limiteArs"
              label="En pesos"
              defaultValue={defaults?.limiteArs}
            />
            <Campo
              name="limiteUsd"
              label="En dólares"
              defaultValue={defaults?.limiteUsd}
            />
          </div>
        </fieldset>
      ) : null}

      {puedeVerPlata && conSaldoInicial ? (
        <fieldset className={propios.grupo}>
          <legend className={styles.label}>¿Ya te debe algo?</legend>
          <p className={styles.hint}>
            Sólo si viene con deuda de antes. Queda anotado como primer
            movimiento de la cuenta, así el extracto explica de dónde sale el
            saldo. Si en cambio te dejó plata a favor, cargala después como un
            pago.
          </p>
          <div className={propios.dosColumnas}>
            <Campo name="debeArs" label="Debe en pesos" />
            <Campo name="debeUsd" label="Debe en dólares" />
          </div>
        </fieldset>
      ) : null}

      <div className={styles.btnRow}>
        <Submit>{submitLabel}</Submit>
      </div>
    </form>
  );
}

/** Archiva o reactiva. No hay borrado: rompería el historial de la cuenta. */
export function ArchivarForm({
  action,
  clienteId,
  isActive,
}: {
  action: FormAction;
  clienteId: string;
  isActive: boolean;
}) {
  const [state, formAction] = useActionState<ClienteFormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className={styles.form}>
      <Aviso state={state} />
      <input type="hidden" name="id" value={clienteId} />
      <p className={styles.hint} style={{ margin: 0 }}>
        {isActive
          ? "Archivar lo saca del listado y del buscador. La cuenta corriente y todo el historial quedan intactos."
          : "Reactivar lo devuelve al listado tal como estaba."}
      </p>
      <div className={styles.btnRow}>
        <Submit variant="plain">{isActive ? "Archivar" : "Reactivar"}</Submit>
      </div>
    </form>
  );
}
