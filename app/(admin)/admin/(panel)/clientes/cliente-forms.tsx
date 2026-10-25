"use client";

import { useActionState, useRef, useState } from "react";
import { cuitValido } from "@/lib/facturacion/cuit";
import { PROVINCIAS } from "@/lib/facturante/provincias";
import { buscarEnPadronClienteAction, type ClienteFormState } from "./actions";
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
  condicionIva?: string | null;
  direccion?: string | null;
  localidad?: string | null;
  provincia?: string | null;
  notas?: string | null;
  percepcionIva?: boolean;
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
      <CompletarDesdeArca />
      <Campo
        name="razonSocial"
        label="Razón social"
        maxLength={160}
        defaultValue={defaults?.razonSocial}
      />
      <div className={styles.field}>
        <label className={styles.label} htmlFor="condicionIva">
          Condición frente al IVA
        </label>
        <select
          id="condicionIva"
          name="condicionIva"
          defaultValue={defaults?.condicionIva ?? ""}
          className={styles.select}
        >
          <option value="">Sin cargar</option>
          <option value="consumidor_final">Consumidor final</option>
          <option value="responsable_inscripto">Responsable inscripto</option>
          <option value="monotributo">Monotributo</option>
          <option value="exento">Exento</option>
        </select>
        <span className={styles.hint}>
          Decide la letra de la factura: a un responsable inscripto le corresponde A.
        </span>
      </div>
      <div className={styles.field}>
        <label className={propios.check}>
          <input
            type="checkbox"
            name="percepcionIva"
            defaultChecked={defaults?.percepcionIva ?? false}
          />
          <span>
            <span className={styles.radioName}>Se le percibe IVA (RG 5329)</span>
            <span className={styles.radioDesc}>
              Para un responsable inscripto que revende sin transformar: almacén,
              vinoteca, restaurante. La factura le suma el 3% sobre las bebidas cuando
              supera el mínimo. Si no es responsable inscripto, no se guarda.
            </span>
          </span>
        </label>
      </div>
      <Campo
        name="direccion"
        label="Dirección"
        hint="La de entrega, y la que sale en la factura junto con la localidad y la provincia."
        maxLength={240}
        defaultValue={defaults?.direccion}
      />
      <div className={propios.dosColumnas}>
        <Campo
          name="localidad"
          label="Localidad"
          maxLength={100}
          defaultValue={defaults?.localidad}
        />
        <div className={styles.field}>
          <label className={styles.label} htmlFor="provincia">
            Provincia
          </label>
          <select
            id="provincia"
            name="provincia"
            defaultValue={defaults?.provincia ?? ""}
            className={styles.select}
          >
            <option value="">—</option>
            {PROVINCIAS.map((p) => (
              <option key={p.code} value={p.code}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

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

/**
 * Trae del padrón de ARCA lo que corresponde al CUIT cargado: razón social,
 * condición frente al IVA y domicilio. El formulario no guarda estado (usa
 * `defaultValue`), así que escribe en los campos directo; se guarda recién al
 * tocar "Guardar". El nombre sólo se completa si está vacío: suele ser cómo se
 * lo conoce, no la razón social.
 */
function CompletarDesdeArca() {
  const boton = useRef<HTMLButtonElement>(null);
  const [aviso, setAviso] = useState<{ error: boolean; texto: string } | null>(null);
  const [buscando, setBuscando] = useState(false);

  async function completar() {
    const form = boton.current?.form;
    if (!form) return;
    const campo = (n: string) => form.elements.namedItem(n) as HTMLInputElement | HTMLSelectElement | null;
    const cuit = (campo("documento")?.value ?? "").replace(/\D/g, "");
    if (!cuitValido(cuit)) {
      setAviso({ error: true, texto: "Cargá un CUIT válido (11 dígitos) para buscarlo." });
      return;
    }
    setBuscando(true);
    setAviso(null);
    const r = await buscarEnPadronClienteAction(cuit).catch(() => ({
      ok: false as const,
      error: "No se pudo consultar el padrón de ARCA.",
    }));
    setBuscando(false);
    if (!r.ok) {
      setAviso({ error: true, texto: r.error });
      return;
    }
    const d = r.datos;
    const poner = (n: string, v: string | null) => {
      const el = campo(n);
      if (el && v) el.value = v;
    };
    if (!campo("nombre")?.value.trim()) poner("nombre", d.razonSocial);
    poner("razonSocial", d.razonSocial);
    poner("condicionIva", d.condicionIva);
    poner("direccion", d.calle);
    poner("localidad", d.localidad);
    poner("provincia", d.provincia);
    setAviso({
      error: false,
      texto: `Completado con el padrón de ARCA${d.calle ? "" : " (vino sin domicilio)"}. Revisalo y guardá.`,
    });
  }

  return (
    <div className={styles.field}>
      <div className={styles.btnRow}>
        <button
          ref={boton}
          type="button"
          onClick={completar}
          disabled={buscando}
          className={`${styles.btn} ${styles.btnSmall}`}
        >
          {buscando ? "Buscando en ARCA…" : "Completar desde ARCA"}
        </button>
      </div>
      {aviso ? (
        <p className={`${styles.alert} ${aviso.error ? styles.alertError : styles.alertOk}`} role="status">
          {aviso.texto}
        </p>
      ) : (
        <span className={styles.hint}>
          Con el CUIT, trae razón social, condición frente al IVA y domicilio fiscal.
        </span>
      )}
    </div>
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
