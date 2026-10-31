import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { documentos } from "@/lib/db/schema";
import { requireFacturacion } from "@/lib/auth";
import { NOMBRE_DOCUMENTO, numeroDocumento } from "@/lib/facturacion/documentos";
import { formatARS, formatFecha } from "@/lib/format";
import styles from "../../../admin.module.css";
import propios from "../facturacion.module.css";

export const metadata = { title: "Presupuestos y recibos" };

const TOPE = 300;
const FILTROS = { presupuesto: "Presupuestos", recibo: "Recibos" } as const;

export default async function DocumentosPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  await requireFacturacion();
  const { tipo: crudo } = await searchParams;
  const tipo = crudo === "presupuesto" || crudo === "recibo" ? crudo : undefined;

  const filas = await db
    .select()
    .from(documentos)
    .where(tipo ? eq(documentos.tipo, tipo) : undefined)
    .orderBy(desc(documentos.fecha), desc(documentos.createdAt))
    .limit(TOPE);

  return (
    <div className={styles.anchoCompleto}>
      <Link href="/admin/facturacion" className={styles.backLink}>
        ← Facturación
      </Link>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>Presupuestos y recibos</h1>
          <p className={styles.pageSub}>Sin validez fiscal. Cada uno se puede pasar a factura.</p>
        </div>
        <div className={styles.btnRow}>
          <Link
            href="/admin/facturacion/documentos/nuevo?tipo=presupuesto"
            className={`${styles.btn} ${styles.btnSmall} ${styles.btnPrimary}`}
          >
            Nuevo presupuesto
          </Link>
          <Link
            href="/admin/facturacion/documentos/nuevo?tipo=recibo"
            className={`${styles.btn} ${styles.btnSmall}`}
          >
            Nuevo recibo
          </Link>
        </div>
      </div>

      <nav className={propios.filtros} aria-label="Tipo">
        <Link
          href="/admin/facturacion/documentos"
          className={`${propios.filtro} ${!tipo ? propios.filtroActivo : ""}`}
        >
          Todos
        </Link>
        {(Object.keys(FILTROS) as (keyof typeof FILTROS)[]).map((t) => (
          <Link
            key={t}
            href={`/admin/facturacion/documentos?tipo=${t}`}
            className={`${propios.filtro} ${tipo === t ? propios.filtroActivo : ""}`}
          >
            {FILTROS[t]}
          </Link>
        ))}
      </nav>

      <section className={`${styles.card} ${styles.cardTight}`}>
        {filas.length === 0 ? (
          <p className={styles.empty}>Todavía no hay ninguno.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Documento</th>
                  <th scope="col">Para</th>
                  <th scope="col" className={propios.importe}>
                    Total
                  </th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((d) => (
                  <tr key={d.id}>
                    <td>{formatFecha(d.fecha)}</td>
                    <td data-label="Documento">
                      <Link href={`/admin/facturacion/documentos/${d.id}`} className={styles.cellName}>
                        {NOMBRE_DOCUMENTO[d.tipo]}{" "}
                        <span className={propios.numero}>{numeroDocumento(d.numero)}</span>
                      </Link>
                    </td>
                    <td data-label="Para">{d.receptorNombre ?? "—"}</td>
                    <td data-label="Total" className={propios.importe}>
                      {formatARS(d.totalCentavos)}
                    </td>
                    <td data-label="Estado">
                      {d.anulado ? "Anulado" : d.facturaId ? "Facturado" : "Sin facturar"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {filas.length === TOPE ? (
        <p className={styles.hint}>Se muestran los {TOPE} más recientes.</p>
      ) : null}
    </div>
  );
}
