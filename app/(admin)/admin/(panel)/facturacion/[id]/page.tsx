import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { clientes, comprobantes, movimientosMp, type Comprobante } from "@/lib/db/schema";
import { requireFacturacion } from "@/lib/auth";
import { formatARS, formatDateTime } from "@/lib/format";
import { facturacionConfigurada } from "@/lib/facturante/config";
import { formatCuit } from "@/lib/facturacion/cuit";
import {
  sePuedeFacturar,
  sePuedeMarcarNoEmitido,
  situacionDe,
  type ComprobanteResumen,
} from "@/lib/facturacion/estado";
import { AccionComprobante } from "../acciones-comprobante";
import { AutoRefresh } from "../auto-refresh";
import { EmitirForm, type DatosIniciales } from "../emitir-form";
import { anularFacturaAction, consultarEstadoAction, marcarNoEmitidoAction } from "../actions";
import styles from "../../../admin.module.css";
import propios from "../facturacion.module.css";

export const metadata = { title: "Facturar cobro" };

const ESTADOS: Record<Comprobante["estado"], string> = {
  pendiente: "Por enviar",
  en_proceso: "Emitiendo…",
  autorizado: "Autorizado",
  rechazado: "Rechazado",
  error: "No se emitió",
  anulado: "Anulada",
};

/** Lo que MP sabe del pagador, como punto de partida del receptor. */
function inicialesDe(m: {
  titular: string | null;
  email: string | null;
  docTipo: string | null;
  docNumero: string | null;
}): DatosIniciales {
  const digitos = (m.docNumero ?? "").replace(/\D/g, "");
  const tipo = m.docTipo?.toUpperCase();
  const doc: Pick<DatosIniciales, "docTipo" | "docNumero"> =
    tipo === "DNI" && digitos
      ? { docTipo: "dni", docNumero: digitos }
      : tipo === "CUIT" && digitos.length === 11
        ? { docTipo: "cuit", docNumero: digitos }
        : // El CUIL de una persona lleva su DNI en el medio: para una B a
          // consumidor final alcanza con eso.
          tipo === "CUIL" && digitos.length === 11
          ? { docTipo: "dni", docNumero: digitos.slice(2, 10).replace(/^0/, "") }
          : { docTipo: "ninguno", docNumero: "" };
  return { nombre: m.titular ?? "", email: m.email ?? "", ...doc };
}

export default async function CobroPage({ params }: { params: Promise<{ id: string }> }) {
  await requireFacturacion();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [mov] = await db.select().from(movimientosMp).where(eq(movimientosMp.id, id)).limit(1);
  if (!mov) notFound();

  const comps = await db
    .select()
    .from(comprobantes)
    .where(eq(comprobantes.movimientoId, id))
    .orderBy(desc(comprobantes.createdAt));

  // Ordenados del más nuevo al más viejo: la primera NC de cada factura es la vigente.
  const ncPorFactura = new Map<string, ComprobanteResumen>();
  for (const c of comps) {
    if (c.tipo === "nota_credito" && c.origenId && !ncPorFactura.has(c.origenId)) {
      ncPorFactura.set(c.origenId, c);
    }
  }
  const situacion = situacionDe(comps, ncPorFactura);
  const enCamino = comps.some((c) => c.estado === "pendiente" || c.estado === "en_proceso");
  const facturable = sePuedeFacturar(situacion);
  const ahora = Date.now();

  const listaClientes = facturable
    ? await db
        .select({
          id: clientes.id,
          nombre: clientes.nombre,
          razonSocial: clientes.razonSocial,
          documento: clientes.documento,
          condicionIva: clientes.condicionIva,
          direccion: clientes.direccion,
          email: clientes.email,
        })
        .from(clientes)
        .where(and(eq(clientes.isActive, true), isNotNull(clientes.documento)))
        .orderBy(asc(clientes.nombre))
    : [];

  return (
    <>
      <AutoRefresh activo={enCamino} />
      <Link href="/admin/facturacion" className={styles.backLink}>
        ← Facturación
      </Link>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>Cobro de {formatARS(mov.montoCentavos)}</h1>
          <p className={styles.pageSub}>
            {mov.titular ?? "Sin titular"} · {formatDateTime(mov.fechaAprobacion)}
          </p>
        </div>
      </div>

      <section className={styles.card} style={{ marginBottom: 18 }}>
        <dl className={propios.cuentaDatos}>
          <dt>Operación de MP</dt>
          <dd>{mov.mpPagoId}</dd>
          <dt>Medio</dt>
          <dd>{mov.metodoPago ?? "—"}</dd>
          <dt>Detalle</dt>
          <dd>{mov.descripcion ?? "—"}</dd>
          <dt>Mail</dt>
          <dd>{mov.email ?? "—"}</dd>
          <dt>Documento</dt>
          <dd>{mov.docNumero ? `${mov.docTipo ?? ""} ${mov.docNumero}` : "—"}</dd>
          <dt>Comisión de MP</dt>
          <dd>{mov.comisionCentavos != null ? formatARS(mov.comisionCentavos) : "—"}</dd>
          <dt>Neto acreditado</dt>
          <dd>{mov.netoCentavos != null ? formatARS(mov.netoCentavos) : "—"}</dd>
        </dl>
      </section>

      {comps.length > 0 ? (
        <section className={`${styles.card} ${styles.cardTight}`} style={{ marginBottom: 18 }}>
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
                      <td>
                        <span className={styles.cellName}>
                          {c.receptorNombre ?? "Consumidor final"}
                        </span>
                        <span className={styles.cellDim}>
                          {c.receptorDocTipo === "ninguno"
                            ? "Sin identificar"
                            : c.receptorDocTipo === "cuit"
                              ? `CUIT ${formatCuit(c.receptorDocNumero)}`
                              : `DNI ${c.receptorDocNumero}`}
                        </span>
                      </td>
                      <td className={propios.importe}>{formatARS(c.totalCentavos)}</td>
                      <td>
                        <span className={propios.estado}>
                          <span>{ESTADOS[c.estado]}</span>
                          {c.cae ? <span className={styles.cellDim}>CAE {c.cae}</span> : null}
                          {c.errorMensaje && c.estado !== "autorizado" ? (
                            <span className={propios.error}>{c.errorMensaje}</span>
                          ) : null}
                          {colgado ? (
                            <span className={propios.error}>
                              Facturante no confirmó. Buscalo en su panel por fecha e importe
                              antes de marcarlo como no emitido.
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
                              confirmar="¿Revisaste en Facturante que este comprobante no existe? Si existe y lo marcás, el cobro puede terminar facturado dos veces."
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
        </section>
      ) : null}

      {facturable ? (
        <section className={styles.card}>
          <h2 className={`${styles.label} ${styles.sectionHead}`}>Facturar</h2>
          {facturacionConfigurada() ? (
            <EmitirForm
              movimientoId={mov.id}
              importeCentavos={mov.montoCentavos}
              iniciales={inicialesDe(mov)}
              clientes={listaClientes.map((c) => ({ ...c, documento: c.documento ?? "" }))}
            />
          ) : (
            <p className={styles.hint}>
              Falta la configuración de Facturante en el entorno (FACTURANTE_* y
              EMISOR_CUIT).
            </p>
          )}
        </section>
      ) : null}
    </>
  );
}
