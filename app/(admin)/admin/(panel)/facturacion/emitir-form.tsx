"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { CondicionIva } from "@/lib/db/schema";
import { PROVINCIAS } from "@/lib/facturante/provincias";
import { formatARS } from "@/lib/format";
import { Aviso, type FormState } from "../form-ui";
import { emitirFacturaAction } from "./actions";
import styles from "../../admin.module.css";
import propios from "./facturacion.module.css";

type DocTipo = "cuit" | "dni" | "ninguno";

export interface ClienteParaFacturar {
  id: string;
  nombre: string;
  razonSocial: string | null;
  documento: string;
  condicionIva: CondicionIva | null;
  direccion: string | null;
  email: string | null;
}

export interface DatosIniciales {
  nombre: string;
  email: string;
  docTipo: DocTipo;
  docNumero: string;
}

const CONDICIONES: { value: CondicionIva; label: string; disabled?: boolean }[] = [
  { value: "consumidor_final", label: "Consumidor final" },
  { value: "responsable_inscripto", label: "Responsable inscripto" },
  { value: "exento", label: "Exento" },
  { value: "monotributo", label: "Monotributo (todavía no)", disabled: true },
];

/** Misma regla que `letraPara` en lib/facturacion/reglas.ts, para mostrarla
 *  antes de enviar. La que vale es la del servidor. */
const letraDe = (c: CondicionIva) => (c === "responsable_inscripto" ? "A" : "B");

const INICIAL: FormState = {};

/**
 * El receptor de la factura. La letra no se elige: sale de la condición frente
 * al IVA. Precargado con lo que mandó MP del pagador; con un cliente elegido,
 * con lo que tiene cargado.
 */
export function EmitirForm({
  movimientoId,
  importeCentavos,
  iniciales,
  clientes,
}: {
  movimientoId: string;
  importeCentavos: number;
  iniciales: DatosIniciales;
  clientes: ClienteParaFacturar[];
}) {
  const [state, action] = useActionState(emitirFacturaAction, INICIAL);

  const [clienteId, setClienteId] = useState("");
  const [condicion, setCondicion] = useState<CondicionIva>("consumidor_final");
  const [docTipo, setDocTipo] = useState<DocTipo>(iniciales.docTipo);
  const [docNumero, setDocNumero] = useState(iniciales.docNumero);
  const [nombre, setNombre] = useState(iniciales.nombre);
  const [email, setEmail] = useState(iniciales.email);
  const [calle, setCalle] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [provincia, setProvincia] = useState("");

  const letra = letraDe(condicion);
  const consumidorFinal = condicion === "consumidor_final";
  // Neto e IVA para mostrar: el precio va con IVA incluido al 21%.
  const neto = Math.round(importeCentavos / 1.21);

  function elegirCliente(id: string) {
    setClienteId(id);
    const c = clientes.find((x) => x.id === id);
    if (!c) return;
    const digitos = c.documento.replace(/\D/g, "");
    const esCuit = digitos.length === 11;
    setCondicion(c.condicionIva ?? (esCuit ? "responsable_inscripto" : "consumidor_final"));
    setDocTipo(esCuit ? "cuit" : "dni");
    setDocNumero(digitos);
    setNombre(c.razonSocial ?? c.nombre);
    setCalle(c.direccion ?? "");
    setEmail(c.email ?? "");
  }

  function elegirCondicion(c: CondicionIva) {
    setCondicion(c);
    if (c !== "consumidor_final") setDocTipo("cuit");
  }

  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="movimientoId" value={movimientoId} />
      <input type="hidden" name="clienteId" value={clienteId} />

      {clientes.length > 0 ? (
        <div className={styles.field}>
          <label className={styles.label} htmlFor="cliente">
            Cliente
          </label>
          <select
            id="cliente"
            value={clienteId}
            onChange={(e) => elegirCliente(e.target.value)}
            className={styles.select}
          >
            <option value="">— Otro, cargar a mano —</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.razonSocial ?? c.nombre} · {c.documento}
              </option>
            ))}
          </select>
          <span className={styles.hint}>
            Sólo aparecen los clientes con CUIT o DNI cargado.
          </span>
        </div>
      ) : null}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="condicionIva">
          Condición frente al IVA
        </label>
        <select
          id="condicionIva"
          name="condicionIva"
          value={condicion}
          onChange={(e) => elegirCondicion(e.target.value as CondicionIva)}
          className={styles.select}
        >
          {CONDICIONES.map((c) => (
            <option key={c.value} value={c.value} disabled={c.disabled}>
              {c.label}
            </option>
          ))}
        </select>
        <span className={styles.hint}>
          Corresponde <strong>Factura {letra}</strong>.
        </span>
      </div>

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="docTipo">
            Documento
          </label>
          <select
            id="docTipo"
            name="docTipo"
            value={docTipo}
            onChange={(e) => setDocTipo(e.target.value as DocTipo)}
            className={styles.select}
          >
            <option value="cuit">CUIT</option>
            {consumidorFinal ? <option value="dni">DNI</option> : null}
            {consumidorFinal ? <option value="ninguno">Sin identificar</option> : null}
          </select>
        </div>
        {docTipo !== "ninguno" ? (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="docNumero">
              Número
            </label>
            <input
              id="docNumero"
              name="docNumero"
              inputMode="numeric"
              value={docNumero}
              onChange={(e) => setDocNumero(e.target.value)}
              maxLength={20}
              required
              autoComplete="off"
              className={styles.input}
            />
          </div>
        ) : null}
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="nombre">
          {consumidorFinal ? "Nombre" : "Razón social"}
        </label>
        <input
          id="nombre"
          name="nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={160}
          required={!consumidorFinal}
          autoComplete="off"
          className={styles.input}
        />
        {consumidorFinal ? (
          <span className={styles.hint}>Vacío sale como “Consumidor final”.</span>
        ) : null}
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="email">
          Mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="off"
          className={styles.input}
        />
        <span className={styles.hint}>Se imprime en la factura. Opcional.</span>
      </div>

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="calle">
            Domicilio{letra === "A" ? "" : " (opcional)"}
          </label>
          <input
            id="calle"
            name="calle"
            value={calle}
            onChange={(e) => setCalle(e.target.value)}
            maxLength={200}
            required={letra === "A"}
            placeholder="Calle y número"
            autoComplete="off"
            className={styles.input}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="ciudad">
            Localidad
          </label>
          <input
            id="ciudad"
            name="ciudad"
            value={ciudad}
            onChange={(e) => setCiudad(e.target.value)}
            maxLength={100}
            autoComplete="off"
            className={styles.input}
          />
        </div>
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="provincia">
          Provincia
        </label>
        <select
          id="provincia"
          name="provincia"
          value={provincia}
          onChange={(e) => setProvincia(e.target.value)}
          required={letra === "A" || calle.trim() !== ""}
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

      <p className={propios.resumen}>
        <span>Neto {formatARS(neto)}</span>
        <span>IVA 21% {formatARS(importeCentavos - neto)}</span>
        <strong>Total {formatARS(importeCentavos)}</strong>
      </p>

      <Aviso state={state} />
      <Boton letra={letra} />
    </form>
  );
}

function Boton({ letra }: { letra: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${styles.btn} ${styles.btnPrimary}`}>
      {pending ? "Reservando…" : `Emitir Factura ${letra}`}
    </button>
  );
}
