"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { CuentaFormState } from "./cuenta-actions";
import { Aviso, Submit, type FormAction } from "../form-ui";
import styles from "../../admin.module.css";
import propios from "./clientes.module.css";

type Tipo = "cargo" | "pago" | "conversion" | "ajuste";

const TIPOS: { valor: Tipo; label: string; ayuda: string }[] = [
  {
    valor: "cargo",
    label: "Cargo",
    ayuda: "Se llevó mercadería. Le sube la deuda.",
  },
  {
    valor: "pago",
    label: "Pago",
    ayuda:
      "Te entregó plata. Si además arreglaron pasarla contra la deuda en la otra moneda, tildá la casilla de abajo.",
  },
  {
    valor: "conversion",
    label: "Conversión",
    ayuda:
      "Pasar saldo de una moneda a la otra: por ejemplo, usar los dólares que tenía a favor contra lo que debe en pesos.",
  },
  {
    valor: "ajuste",
    label: "Ajuste",
    ayuda: "Una corrección o un redondeo. Escribí bien el motivo.",
  },
];

/**
 * Carga un movimiento. Un solo formulario para los cuatro tipos: lo que cambia
 * son dos o tres campos, y tener cuatro pantallas para eso sólo obligaría a
 * elegir antes de empezar a escribir.
 */
export function MovimientoForm({
  action,
  clienteId,
  hoy,
}: {
  action: FormAction;
  clienteId: string;
  hoy: string;
}) {
  const [state, formAction] = useActionState<CuentaFormState, FormData>(
    action,
    {},
  );
  const [tipo, setTipo] = useState<Tipo>("cargo");
  const [moneda, setMoneda] = useState<"ARS" | "USD">("ARS");
  const [aplicar, setAplicar] = useState(false);

  const elegido = TIPOS.find((t) => t.valor === tipo)!;
  const otraMoneda = moneda === "ARS" ? "dólares" : "pesos";
  const pideCotizacion = tipo === "conversion" || (tipo === "pago" && aplicar);

  return (
    <form action={formAction} className={styles.form}>
      <Aviso state={state} />
      <input type="hidden" name="clienteId" value={clienteId} />

      <div className={styles.field}>
        <span className={styles.label}>Qué pasó</span>
        <div className={propios.tipoSelector}>
          {TIPOS.map((t) => (
            <label
              key={t.valor}
              className={`${propios.tipoOpcion} ${
                t.valor === tipo ? propios.tipoOpcionActiva : ""
              }`}
            >
              <input
                type="radio"
                name="tipo"
                value={t.valor}
                checked={t.valor === tipo}
                onChange={() => setTipo(t.valor)}
              />
              {t.label}
            </label>
          ))}
        </div>
        <span className={styles.hint}>{elegido.ayuda}</span>
      </div>

      <div className={propios.dosColumnas}>
        <div className={styles.field}>
          <span className={styles.label}>
            {tipo === "conversion" ? "Desde qué moneda" : "Moneda"}
          </span>
          <div className={propios.tipoSelector}>
            {(["ARS", "USD"] as const).map((m) => (
              <label
                key={m}
                className={`${propios.tipoOpcion} ${
                  m === moneda ? propios.tipoOpcionActiva : ""
                }`}
              >
                <input
                  type="radio"
                  name="moneda"
                  value={m}
                  checked={m === moneda}
                  onChange={() => setMoneda(m)}
                />
                {m === "ARS" ? "Pesos" : "Dólares"}
              </label>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="monto">
            Importe
          </label>
          <input
            id="monto"
            name="monto"
            type="text"
            inputMode="decimal"
            required
            autoComplete="off"
            placeholder={moneda === "ARS" ? "5.000.000" : "2.000"}
            className={styles.input}
          />
          <span className={styles.hint}>
            Se entiende con puntos o sin ellos. Los centavos van con coma.
          </span>
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="fecha">
          Fecha
        </label>
        <input
          id="fecha"
          name="fecha"
          type="date"
          max={hoy}
          defaultValue={hoy}
          className={styles.input}
        />
        <span className={styles.hint}>
          La del hecho, no la de la carga: si la mercadería salió el viernes, va
          el viernes aunque lo anotes el lunes.
        </span>
      </div>

      {tipo === "ajuste" ? (
        <div className={styles.field}>
          <span className={styles.label}>A favor de quién</span>
          <div className={propios.tipoSelector}>
            <label className={propios.tipoOpcion}>
              <input type="radio" name="sentido" value="contra" defaultChecked />
              Le suma deuda
            </label>
            <label className={propios.tipoOpcion}>
              <input type="radio" name="sentido" value="favor" />
              Le suma saldo a favor
            </label>
          </div>
        </div>
      ) : null}

      {tipo === "pago" ? (
        <div className={styles.field}>
          <label className={propios.check}>
            <input
              type="checkbox"
              name="aplicar"
              checked={aplicar}
              onChange={(e) => setAplicar(e.target.checked)}
            />
            <span>
              <span className={styles.radioName}>
                Aplicarlo a la cuenta en {otraMoneda}
              </span>
              <span className={styles.radioDesc}>
                Sin esto, la plata queda como saldo a favor en{" "}
                {moneda === "ARS" ? "pesos" : "dólares"} y no se pesifica ni se
                dolariza sola.
              </span>
            </span>
          </label>
        </div>
      ) : null}

      {pideCotizacion ? (
        <div className={styles.field}>
          <label className={styles.label} htmlFor="cotizacion">
            Tipo de cambio acordado
          </label>
          <input
            id="cotizacion"
            name="cotizacion"
            type="text"
            inputMode="decimal"
            required
            autoComplete="off"
            placeholder="1.200"
            className={styles.input}
          />
          <span className={styles.hint}>
            Pesos por dólar, el que arreglaron en el momento. Queda asentado en
            el extracto.
          </span>
        </div>
      ) : null}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="detalle">
          Detalle
        </label>
        <input
          id="detalle"
          name="detalle"
          type="text"
          required
          maxLength={300}
          autoComplete="off"
          placeholder="6 cajas Malbec Reserva"
          className={styles.input}
        />
      </div>

      <div className={styles.btnRow}>
        <Submit>Registrar movimiento</Submit>
      </div>
    </form>
  );
}

/**
 * El botón, aparte del formulario a propósito: `useFormStatus` sólo ve el
 * envío desde un componente que esté **dentro** del `<form>`. Leído en el
 * mismo componente que lo renderiza, `pending` no se entera de nada.
 */
function BotonAnular() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${styles.btn} ${styles.btnSmall}`}
      title="Agrega la operación inversa. El movimiento original no se borra."
    >
      {pending ? "Anulando…" : "Anular"}
    </button>
  );
}

/** Anula una operación entera. El botón vive en la fila del extracto. */
export function AnularForm({
  action,
  grupoId,
}: {
  action: FormAction;
  grupoId: string;
}) {
  const [state, formAction] = useActionState<CuentaFormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="grupoId" value={grupoId} />
      <BotonAnular />
      {state.error ? (
        <span className={propios.errorInline} role="alert">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
