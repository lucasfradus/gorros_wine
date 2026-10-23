import Link from "next/link";
import { and, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { comprobantes, comprobanteEstado, type Comprobante } from "@/lib/db/schema";
import { requireFacturacion } from "@/lib/auth";
import { formatARS, formatDateTime, hoyEnArgentina } from "@/lib/format";
import { formatCuit } from "@/lib/facturacion/cuit";
import styles from "../../../admin.module.css";
import propios from "../facturacion.module.css";

export const metadata = { title: "Comprobantes" };

const TOPE = 300;
const DIA = 24 * 60 * 60 * 1000;
const esDia = (v?: string): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
/** Medianoche de Buenos Aires (UTC-3 todo el año). */
const inicioDelDia = (dia: string) => new Date(`${dia}T00:00:00-03:00`);

const ESTADOS: Record<Comprobante["estado"], string> = {
  pendiente: "Por enviar",
  en_proceso: "Emitiendo…",
  autorizado: "Autorizado",
  rechazado: "Rechazado",
  error: "No se emitió",
  anulado: "Anulada",
};

export default async function ComprobantesPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; letra?: string; estado?: string }>;
}) {
  await requireFacturacion();
  const params = await searchParams;

  const hoy = hoyEnArgentina();
  const hasta = esDia(params.hasta) ? params.hasta : hoy;
  const desde = esDia(params.desde)
    ? params.desde
    : new Date(inicioDelDia(hoy).getTime() - 30 * DIA + 3 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
  const letra = params.letra === "A" || params.letra === "B" ? params.letra : undefined;
  const estado = comprobanteEstado.enumValues.find((e) => e === params.estado);

  const filas = await db
    .select()
    .from(comprobantes)
    .where(
      and(
        gte(comprobantes.createdAt, inicioDelDia(desde)),
        lt(comprobantes.createdAt, new Date(inicioDelDia(hasta).getTime() + DIA)),
        letra ? eq(comprobantes.letra, letra) : undefined,
        estado ? eq(comprobantes.estado, estado) : undefined,
      ),
    )
    .orderBy(desc(comprobantes.createdAt))
    .limit(TOPE);

  const suma = (f: (c: Comprobante) => boolean) =>
    filas.filter(f).reduce((s, c) => s + c.totalCentavos, 0);
  // Para mostrar qué factura anula cada NC sin otra consulta (si la factura
  // cae fuera del período, se dice genérico).
  const numeroDe = new Map(filas.map((c) => [c.id, c.numeroCompleto]));

  return (
    <>
      <Link href="/admin/facturacion" className={styles.backLink}>
        ← Facturación
      </Link>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>Comprobantes</h1>
          <p className={styles.pageSub}>Todo lo emitido desde acá, facturas y notas de crédito.</p>
        </div>
      </div>

      <form className={propios.periodo}>
        <label className={propios.syncCampo}>
          <span className={styles.label}>Desde</span>
          <input type="date" name="desde" defaultValue={desde} className={styles.input} />
        </label>
        <label className={propios.syncCampo}>
          <span className={styles.label}>Hasta</span>
          <input type="date" name="hasta" defaultValue={hasta} className={styles.input} />
        </label>
        <label className={propios.syncCampo}>
          <span className={styles.label}>Letra</span>
          <select name="letra" defaultValue={letra ?? ""} className={styles.select}>
            <option value="">Todas</option>
            <option value="A">A</option>
            <option value="B">B</option>
          </select>
        </label>
        <label className={propios.syncCampo}>
          <span className={styles.label}>Estado</span>
          <select name="estado" defaultValue={estado ?? ""} className={styles.select}>
            <option value="">Todos</option>
            {comprobanteEstado.enumValues.map((e) => (
              <option key={e} value={e}>
                {ESTADOS[e]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={`${styles.btn} ${styles.btnSmall}`}>
          Ver
        </button>
      </form>

      <p className={propios.totales}>
        <span>
          Facturas autorizadas{" "}
          <strong>
            {formatARS(suma((c) => c.tipo === "factura" && c.estado === "autorizado"))}
          </strong>
        </span>
        <span>
          Notas de crédito{" "}
          <strong>
            {formatARS(suma((c) => c.tipo === "nota_credito" && c.estado === "autorizado"))}
          </strong>
        </span>
      </p>

      <section className={`${styles.card} ${styles.cardTight}`}>
        {filas.length === 0 ? (
          <p className={styles.empty}>No hay comprobantes en este período.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Comprobante</th>
                  <th scope="col">Receptor</th>
                  <th scope="col" className={propios.importe}>
                    Total
                  </th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((c) => (
                  <tr key={c.id}>
                    <td>{formatDateTime(c.createdAt)}</td>
                    <td>
                      <span className={styles.cellName}>
                        {c.tipo === "factura" ? "Factura" : "NC"} {c.letra}{" "}
                        {c.numeroCompleto && c.pdfUrl ? (
                          <a href={c.pdfUrl} target="_blank" rel="noreferrer" className={propios.numero}>
                            {c.numeroCompleto}
                          </a>
                        ) : (
                          <span className={propios.numero}>{c.numeroCompleto ?? ""}</span>
                        )}
                      </span>
                      <span className={styles.cellDim}>
                        {c.origenId ? `Anula ${numeroDe.get(c.origenId) ?? "una factura"}` : null}
                        {c.cae ? ` CAE ${c.cae}` : null}
                      </span>
                    </td>
                    <td>
                      <span className={styles.cellName}>{c.receptorNombre ?? "Consumidor final"}</span>
                      <span className={styles.cellDim}>
                        {c.receptorDocTipo === "ninguno"
                          ? "Sin identificar"
                          : c.receptorDocTipo === "cuit"
                            ? `CUIT ${formatCuit(c.receptorDocNumero)}`
                            : `DNI ${c.receptorDocNumero}`}
                      </span>
                    </td>
                    <td className={propios.importe}>
                      {formatARS(c.tipo === "nota_credito" ? -c.totalCentavos : c.totalCentavos)}
                    </td>
                    <td>
                      <span className={propios.estado}>
                        <Link href={`/admin/facturacion/${c.movimientoId}`}>{ESTADOS[c.estado]}</Link>
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
        )}
      </section>
      {filas.length === TOPE ? (
        <p className={styles.hint}>
          Se muestran los {TOPE} más recientes. Achicá las fechas para ver el resto.
        </p>
      ) : null}
    </>
  );
}
