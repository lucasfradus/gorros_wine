import type { Comprobante } from "@/lib/db/schema";
import { formatARS, formatDateTime } from "@/lib/format";
import { formatCuit } from "@/lib/facturacion/cuit";
import { sePuedeMarcarNoEmitido } from "@/lib/facturacion/estado";
import { AccionComprobante } from "./acciones-comprobante";
import { anularFacturaAction, consultarEstadoAction, marcarNoEmitidoAction } from "./actions";
import styles from "../../admin.module.css";
import propios from "./facturacion.module.css";

export const ESTADOS: Record<Comprobante["estado"], string> = {
  pendiente: "Por enviar",
  en_proceso: "Emitiendo…",
  autorizado: "Autorizado",
  rechazado: "Rechazado",
  error: "No se emitió",
  anulado: "Anulada",
};

/** "CUIT 20-…", "DNI …" o "Sin identificar". */
export function documentoReceptor(c: Pick<Comprobante, "receptorDocTipo" | "receptorDocNumero">) {
  return c.receptorDocTipo === "ninguno"
    ? "Sin identificar"
    : c.receptorDocTipo === "cuit"
      ? `CUIT ${formatCuit(c.receptorDocNumero)}`
      : `DNI ${c.receptorDocNumero}`;
}

/**
 * Los comprobantes de un cobro o de una factura manual, con lo que se puede
 * hacer con cada uno: anular con NC, consultar el estado, marcar como no
 * emitido. Espera la lista del más nuevo al más viejo: la primera NC de cada
 * factura es la vigente.
 */
export function TablaComprobantes({ comps }: { comps: Comprobante[] }) {
  const ncPorFactura = new Map<string, Comprobante>();
  for (const c of comps) {
    if (c.tipo === "nota_credito" && c.origenId && !ncPorFactura.has(c.origenId)) {
      ncPorFactura.set(c.origenId, c);
    }
  }
  const ahora = Date.now();

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Comprobante</th>
            <th scope="col">Receptor</th>
            <th scope="col" className={propios.importe}>
              Total
            </th>
            <th scope="col">Estado</th>
            <th scope="col" aria-label="Acciones" />
          </tr>
        </thead>
        <tbody>
          {comps.map((c) => {
            const nc = c.tipo === "factura" ? ncPorFactura.get(c.id) : undefined;
            const puedeAnular =
              c.tipo === "factura" &&
              c.estado === "autorizado" &&
              (!nc || nc.estado === "rechazado" || nc.estado === "error");
            const enViaje = c.estado === "en_proceso" || c.estado === "pendiente";
            // Sin id de Facturante no hay a quién preguntarle: pasada la
            // espera del webhook, lo resuelve una persona mirando su panel.
            const colgado = sePuedeMarcarNoEmitido(c, ahora);
            return (
              <tr key={c.id}>
                <td>
                  <span className={styles.cellName}>
                    {c.tipo === "factura" ? "Factura" : "Nota de crédito"} {c.letra}
                  </span>
                  <span className={styles.cellDim}>
                    {c.numeroCompleto && c.pdfUrl ? (
                      <a href={c.pdfUrl} target="_blank" rel="noreferrer">
                        {c.numeroCompleto}
                      </a>
                    ) : (
                      (c.numeroCompleto ?? formatDateTime(c.createdAt))
                    )}
                  </span>
                </td>
                <td data-label="Receptor">
                  <span className={styles.cellName}>{c.receptorNombre ?? "Consumidor final"}</span>
                  <span className={styles.cellDim}>{documentoReceptor(c)}</span>
                </td>
                <td data-label="Total" className={propios.importe}>
                  {formatARS(c.totalCentavos)}
                </td>
                <td data-label="Estado">
                  <span className={propios.estado}>
                    <span>{ESTADOS[c.estado]}</span>
                    {c.cae ? <span className={styles.cellDim}>CAE {c.cae}</span> : null}
                    {c.errorMensaje && c.estado !== "autorizado" ? (
                      <span className={propios.error}>{c.errorMensaje}</span>
                    ) : null}
                    {colgado ? (
                      <span className={propios.error}>
                        Facturante no confirmó. Buscalo en su panel por fecha e importe antes de
                        marcarlo como no emitido.
                      </span>
                    ) : null}
                  </span>
                </td>
                <td>
                  <div className={styles.btnRow}>
                    {puedeAnular ? (
                      <AccionComprobante
                        action={anularFacturaAction}
                        id={c.id}
                        label="Anular con NC"
                        pendiente="Reservando…"
                        confirmar={`Se va a emitir una nota de crédito ${c.letra} por ${formatARS(c.totalCentavos)} que anula la ${c.numeroCompleto}. No se puede deshacer.`}
                        peligro
                      />
                    ) : null}
                    {enViaje && c.facturanteId ? (
                      <AccionComprobante
                        action={consultarEstadoAction}
                        id={c.id}
                        label="Consultar estado"
                        pendiente="Consultando…"
                      />
                    ) : null}
                    {colgado ? (
                      <AccionComprobante
                        action={marcarNoEmitidoAction}
                        id={c.id}
                        label="No se emitió"
                        pendiente="Marcando…"
                        confirmar="¿Revisaste en Facturante que este comprobante no existe? Si existe y lo marcás, la venta puede terminar facturada dos veces."
                        peligro
                      />
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
