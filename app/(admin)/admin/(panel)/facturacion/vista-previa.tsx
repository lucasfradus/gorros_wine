"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { Calculo } from "@/lib/facturacion/calculo";
import { formatCuit } from "@/lib/facturacion/cuit";
import { PROVINCIAS } from "@/lib/facturante/provincias";
import { formatARS, formatFecha } from "@/lib/format";
import { Aviso, type FormState } from "../form-ui";
import type { ClienteParaFacturar } from "./receptor-campos";
import styles from "../../admin.module.css";
import propios from "./facturacion.module.css";

const CONDICION: Record<string, string> = {
  consumidor_final: "Consumidor final",
  responsable_inscripto: "Responsable inscripto",
  exento: "Exento",
  monotributo: "Monotributo",
};

const digitos = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

/** Lo que el formulario tiene cargado en el receptor, leído al abrir. */
interface Receptor {
  nombre: string;
  documento: string;
  condicion: string;
  domicilio: string;
  email: string;
  cliente: string;
}

function leerReceptor(fd: FormData, clientes: ClienteParaFacturar[]): Receptor {
  const campo = (k: string) => String(fd.get(k) ?? "").trim();
  const docTipo = campo("docTipo");
  const docNumero = digitos(campo("docNumero"));
  const nombre = campo("nombre");
  const provincia = PROVINCIAS.find((p) => p.code === campo("provincia"))?.nombre;

  // Lo mismo que decide `resolverCliente` en el servidor, dicho en palabras.
  const elegido = clientes.find((c) => c.id === campo("clienteId"));
  const mismoDoc = docNumero ? clientes.find((c) => digitos(c.documento) === docNumero) : undefined;
  const cliente = elegido
    ? `Queda asociada a ${elegido.razonSocial ?? elegido.nombre}.`
    : mismoDoc
      ? `Queda asociada a ${mismoDoc.razonSocial ?? mismoDoc.nombre}, que tiene ese documento.`
      : fd.get("guardarCliente") === "on" && nombre
        ? "Se guarda como cliente nuevo."
        : "No se guarda como cliente.";

  return {
    nombre: nombre || "Consumidor final",
    documento:
      docTipo === "cuit"
        ? `CUIT ${formatCuit(docNumero)}`
        : docTipo === "dni"
          ? `DNI ${docNumero}`
          : "Sin identificar",
    condicion: CONDICION[campo("condicionIva")] ?? "",
    domicilio: [campo("calle"), campo("ciudad"), provincia].filter(Boolean).join(", "),
    email: campo("email"),
    cliente,
  };
}

/**
 * El botón de emitir pasa por una vista previa: lo que se emite no se edita
 * después (se anula con nota de crédito), así que se muestra entero antes.
 *
 * Va adentro del `<form>`: el "Emitir" del diálogo es el submit del formulario.
 * Al abrir, primero corre la validación del navegador (campos obligatorios) y
 * recién ahí lee el receptor del formulario, así no hace falta subir su estado.
 */
export function VistaPrevia({
  letra,
  fecha,
  formaPago,
  calc,
  clientes,
  state,
  deshabilitado,
}: {
  letra: string;
  /** "AAAA-MM-DD". */
  fecha: string;
  formaPago: string;
  calc: Calculo;
  clientes: ClienteParaFacturar[];
  state: FormState;
  deshabilitado: boolean;
}) {
  const abrir = useRef<HTMLButtonElement>(null);
  const dialogo = useRef<HTMLDialogElement>(null);
  const [receptor, setReceptor] = useState<Receptor | null>(null);

  function revisar() {
    const form = abrir.current?.form;
    if (!form || !form.reportValidity()) return;
    setReceptor(leerReceptor(new FormData(form), clientes));
    dialogo.current?.showModal();
  }

  return (
    <>
      <Aviso state={state} />
      <button
        ref={abrir}
        type="button"
        onClick={revisar}
        disabled={deshabilitado}
        className={`${styles.btn} ${styles.btnPrimary}`}
      >
        Revisar y emitir Factura {letra}
      </button>

      <dialog
        ref={dialogo}
        className={propios.vista}
        aria-labelledby="vista-titulo"
        onClose={() => setReceptor(null)}
      >
        {receptor ? (
          <>
            <h2 id="vista-titulo" className={propios.vistaTitulo}>
              Factura {letra} · {formatFecha(fecha)}
            </h2>
            <p className={propios.vistaSub}>Forma de pago: {formaPago}</p>

            <dl className={propios.vistaReceptor}>
              <div>
                <dt>Receptor</dt>
                <dd>
                  <strong>{receptor.nombre}</strong>
                  <span>
                    {receptor.documento}
                    {receptor.condicion ? ` · ${receptor.condicion}` : null}
                  </span>
                  {receptor.domicilio ? <span>{receptor.domicilio}</span> : null}
                  {receptor.email ? <span>{receptor.email}</span> : null}
                </dd>
              </div>
              <div>
                <dt>Cliente</dt>
                <dd>{receptor.cliente}</dd>
              </div>
            </dl>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Detalle</th>
                    <th scope="col" className={propios.importe}>
                      Cant.
                    </th>
                    <th scope="col" className={propios.importe}>
                      Precio
                    </th>
                    <th scope="col" className={propios.importe}>
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {calc.renglones.map((r, i) => (
                    <tr key={i}>
                      <td>
                        <span className={styles.cellName}>{r.descripcion}</span>
                        {r.descuentoPct ? (
                          <span className={styles.cellDim}>
                            {String(r.descuentoPct).replace(".", ",")}% de descuento
                          </span>
                        ) : null}
                      </td>
                      <td data-label="Cant." className={propios.importe}>
                        {r.cantidad}
                      </td>
                      <td data-label="Precio" className={propios.importe}>
                        {formatARS(r.precioFinalCentavos)}
                      </td>
                      <td data-label="Subtotal" className={propios.importe}>
                        {formatARS(r.subtotalCentavos)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className={propios.resumen}>
              <span>Neto {formatARS(calc.netoCentavos)}</span>
              <span>IVA 21% {formatARS(calc.ivaCentavos)}</span>
              {calc.percepciones.map((p) => (
                <span key={p.tipo}>Percepción IVA 3% {formatARS(p.montoCentavos)}</span>
              ))}
              <strong>Total {formatARS(calc.totalCentavos)}</strong>
            </p>

            <p className={styles.hint}>
              Una vez emitida no se puede modificar: si algo está mal, se anula con nota de
              crédito.
            </p>
            <Aviso state={state} />
            <div className={styles.btnRow}>
              <button
                type="button"
                onClick={() => dialogo.current?.close()}
                className={styles.btn}
              >
                Volver a editar
              </button>
              <Emitir letra={letra} />
            </div>
          </>
        ) : null}
      </dialog>
    </>
  );
}

function Emitir({ letra }: { letra: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${styles.btn} ${styles.btnPrimary}`}>
      {pending ? "Emitiendo…" : `Emitir Factura ${letra}`}
    </button>
  );
}
