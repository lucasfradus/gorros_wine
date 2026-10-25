import Link from "next/link";
import type { Comprobante } from "@/lib/db/schema";
import { formatARS, formatFecha } from "@/lib/format";
import { EstadoComprobante } from "./en-curso";
import { ESTADOS, documentoReceptor } from "./tabla-comprobantes";
import styles from "../../admin.module.css";
import propios from "./facturacion.module.css";

/**
 * Dónde se ve un comprobante: lo de un cobro, en su cobro; una manual, en su
 * detalle; una NC, en el de la factura que anula, que es donde está la acción.
 */
export function detalleDe(c: Pick<Comprobante, "id" | "movimientoId" | "origenId">) {
  return c.movimientoId
    ? `/admin/facturacion/${c.movimientoId}`
    : `/admin/facturacion/manual/${c.origenId ?? c.id}`;
}

/** "FA 00002-00000005" → "00002-00000005": la letra ya está en el rótulo. */
const sinPrefijo = (n: string | null) => (n ?? "").replace(/^[A-Z]+\s+/, "");

/**
 * El listado de comprobantes, sólo lectura: el inicio de Facturación y la
 * ficha del cliente. Las acciones (anular, consultar) viven en el detalle.
 */
export function ListaComprobantes({
  comps,
  conReceptor = true,
}: {
  comps: Comprobante[];
  conReceptor?: boolean;
}) {
  // Para decir qué factura anula cada NC sin otra consulta. Si la factura cae
  // fuera de la lista, se dice genérico.
  const numeroDe = new Map(comps.map((c) => [c.id, c.numeroCompleto]));

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Fecha</th>
            <th scope="col">Comprobante</th>
            {conReceptor ? <th scope="col">Receptor</th> : null}
            <th scope="col" className={propios.importe}>
              Total
            </th>
            <th scope="col">Estado</th>
          </tr>
        </thead>
        <tbody>
          {comps.map((c) => (
            <tr key={c.id}>
              <td>{formatFecha(c.fecha)}</td>
              <td data-label="Comprobante">
                <Link href={detalleDe(c)} className={styles.cellName}>
                  {c.tipo === "factura" ? "Factura" : "NC"} {c.letra}{" "}
                  <span className={propios.numero}>{sinPrefijo(c.numeroCompleto)}</span>
                </Link>
                <span className={styles.cellDim}>
                  {[
                    c.movimientoId ? "Mercado Pago" : "Manual",
                    c.origenId ? `anula ${numeroDe.get(c.origenId) ?? "una factura"}` : null,
                    c.tributos?.length ? "con percepción" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  {c.pdfUrl ? (
                    <>
                      {" · "}
                      <a href={c.pdfUrl} target="_blank" rel="noreferrer">
                        PDF
                      </a>
                    </>
                  ) : null}
                </span>
              </td>
              {conReceptor ? (
                <td data-label="Receptor">
                  <span className={styles.cellName}>{c.receptorNombre ?? "Consumidor final"}</span>
                  <span className={styles.cellDim}>{documentoReceptor(c)}</span>
                </td>
              ) : null}
              <td data-label="Total" className={propios.importe}>
                {formatARS(c.tipo === "nota_credito" ? -c.totalCentavos : c.totalCentavos)}
              </td>
              <td data-label="Estado">
                <span className={propios.estado}>
                  <EstadoComprobante c={c} texto={ESTADOS[c.estado]} />
                  {c.errorMensaje && c.estado !== "autorizado" ? (
                    <span className={propios.error}>{c.errorMensaje}</span>
                  ) : null}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
