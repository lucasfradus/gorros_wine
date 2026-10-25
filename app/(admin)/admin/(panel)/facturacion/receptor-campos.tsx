"use client";

import { useState } from "react";
import type { CondicionIva } from "@/lib/db/schema";
import { PROVINCIAS } from "@/lib/facturante/provincias";
import { ClienteBuscador, etiquetaCliente } from "./cliente-buscador";
import styles from "../../admin.module.css";
import propios from "./facturacion.module.css";

type DocTipo = "cuit" | "dni" | "ninguno";

export interface ClienteParaFacturar {
  id: string;
  nombre: string;
  apodo: string | null;
  razonSocial: string | null;
  documento: string | null;
  condicionIva: CondicionIva | null;
  percepcionIva: boolean;
  direccion: string | null;
  localidad: string | null;
  provincia: string | null;
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
export const letraDe = (c: CondicionIva) => (c === "responsable_inscripto" ? "A" : "B");

export const SIN_IDENTIFICAR: DatosIniciales = { nombre: "", email: "", docTipo: "ninguno", docNumero: "" };

const digitos = (s: string | null) => (s ?? "").replace(/\D/g, "");

/**
 * Quién recibe la factura: los campos que mandan `emitirFacturaAction` y
 * `emitirFacturaManualAction`. La letra no se elige: sale de la condición
 * frente al IVA.
 *
 * Con un cliente elegido, se precarga con lo que tiene. Sin cliente, "Guardar
 * como cliente" viene tildado: lo que se factura a mano suele volver. Si el
 * documento tipeado ya es de un cliente, se avisa, y el servidor asocia a ese
 * en vez de crear otro (`resolverCliente` en lib/facturacion/emitir.ts).
 *
 * Avisa hacia arriba la condición y el cliente, que el formulario de venta
 * necesita para la letra y la percepción.
 */
export function ReceptorCampos({
  iniciales,
  clientes,
  onCambio,
}: {
  iniciales: DatosIniciales;
  clientes: ClienteParaFacturar[];
  onCambio?: (r: { condicion: CondicionIva; cliente: ClienteParaFacturar | null }) => void;
}) {
  const [cliente, setCliente] = useState<ClienteParaFacturar | null>(null);
  const [condicion, setCondicion] = useState<CondicionIva>("consumidor_final");
  const [docTipo, setDocTipo] = useState<DocTipo>(iniciales.docTipo);
  const [docNumero, setDocNumero] = useState(iniciales.docNumero);
  const [nombre, setNombre] = useState(iniciales.nombre);
  const [email, setEmail] = useState(iniciales.email);
  const [calle, setCalle] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [provincia, setProvincia] = useState("");
  const [guardar, setGuardar] = useState(true);

  const letra = letraDe(condicion);
  const consumidorFinal = condicion === "consumidor_final";

  // ¿El documento tipeado ya es de alguien? Desde 7 dígitos, que es un DNI.
  const tipeado = docTipo === "ninguno" ? "" : digitos(docNumero);
  const coincide =
    !cliente && tipeado.length >= 7
      ? (clientes.find((c) => digitos(c.documento) === tipeado) ?? null)
      : null;

  function elegirCliente(c: ClienteParaFacturar | null) {
    setCliente(c);
    if (!c) {
      // Volver a cargar a mano arranca de cero (o de lo que trajo el cobro),
      // no con los datos del cliente que se acaba de sacar. La condición
      // también: un RI con el documento vaciado sería un estado sin salida.
      setCondicion("consumidor_final");
      setDocTipo(iniciales.docTipo);
      setDocNumero(iniciales.docNumero);
      setNombre(iniciales.nombre);
      setEmail(iniciales.email);
      setCalle("");
      setCiudad("");
      setProvincia("");
      onCambio?.({ condicion: "consumidor_final", cliente: null });
      return;
    }
    const doc = digitos(c.documento);
    const esCuit = doc.length === 11;
    const nueva = c.condicionIva ?? (esCuit ? "responsable_inscripto" : "consumidor_final");
    setCondicion(nueva);
    setDocTipo(esCuit ? "cuit" : doc ? "dni" : nueva === "consumidor_final" ? "ninguno" : "cuit");
    setDocNumero(doc);
    setNombre(c.razonSocial ?? c.nombre);
    setEmail(c.email ?? "");
    setCalle(c.direccion ?? "");
    setCiudad(c.localidad ?? "");
    setProvincia(c.provincia ?? "");
    onCambio?.({ condicion: nueva, cliente: c });
  }

  function elegirCondicion(c: CondicionIva) {
    setCondicion(c);
    if (c !== "consumidor_final") setDocTipo("cuit");
    onCambio?.({ condicion: c, cliente });
  }

  return (
    <>
      <input type="hidden" name="clienteId" value={cliente?.id ?? ""} />

      <ClienteBuscador clientes={clientes} elegido={cliente} onElegir={elegirCliente} />

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
      {coincide ? (
        <p className={propios.coincide} role="status">
          <span>
            Ese documento ya es de <strong>{etiquetaCliente(coincide)}</strong>: la
            factura queda asociada a ese cliente.
          </span>
          <button
            type="button"
            onClick={() => elegirCliente(coincide)}
            className={`${styles.btn} ${styles.btnSmall}`}
          >
            Usar sus datos
          </button>
        </p>
      ) : null}

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

      {cliente || coincide ? null : (
        <div className={styles.field}>
          <label className={propios.renglonCheck}>
            <input
              type="checkbox"
              name="guardarCliente"
              checked={guardar}
              onChange={(e) => setGuardar(e.target.checked)}
            />
            Guardar como cliente
          </label>
          <span className={styles.hint}>
            {nombre.trim()
              ? "Queda en Clientes con estos datos, para la próxima."
              : "Hace falta el nombre: sin nombre no se guarda."}
          </span>
        </div>
      )}
    </>
  );
}
