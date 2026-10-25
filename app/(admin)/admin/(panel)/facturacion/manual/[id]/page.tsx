import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc, desc, eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { clientes, comprobanteItems, comprobantes } from "@/lib/db/schema";
import { FORMAS_DE_PAGO } from "@/lib/facturacion/formas-de-pago";
import { requireFacturacion } from "@/lib/auth";
import { formatARS, formatFecha } from "@/lib/format";
import { AutoRefresh } from "../../auto-refresh";
import { AvisoEmitiendo } from "../../en-curso";
import { TablaComprobantes, documentoReceptor } from "../../tabla-comprobantes";
import styles from "../../../../admin.module.css";
import propios from "../../facturacion.module.css";

export const metadata = { title: "Factura" };

export default async function FacturaManualDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireFacturacion();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [c] = await db.select().from(comprobantes).where(eq(comprobantes.id, id)).limit(1);
  if (!c) notFound();
  // La de un cobro se ve en su cobro; una NC, en la factura que anula.
  if (c.movimientoId) redirect(`/admin/facturacion/${c.movimientoId}`);
  if (c.tipo === "nota_credito" && c.origenId) redirect(`/admin/facturacion/manual/${c.origenId}`);

  const [comps, items, [cliente]] = await Promise.all([
    db
      .select()
      .from(comprobantes)
      .where(or(eq(comprobantes.id, id), eq(comprobantes.origenId, id)))
      .orderBy(desc(comprobantes.createdAt)),
    db
      .select()
      .from(comprobanteItems)
      .where(eq(comprobanteItems.comprobanteId, id))
      .orderBy(asc(comprobanteItems.orden)),
    c.clienteId
      ? db
          .select({ id: clientes.id, nombre: clientes.nombre })
          .from(clientes)
          .where(eq(clientes.id, c.clienteId))
          .limit(1)
      : Promise.resolve([]),
  ]);
  const enCamino = comps.some((x) => x.estado === "pendiente" || x.estado === "en_proceso");

  return (
    <>
      <AutoRefresh activo={enCamino} />
      <Link href="/admin/facturacion" className={styles.backLink}>
        ← Facturación
      </Link>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>
            Factura {c.letra} de {formatARS(c.totalCentavos)}
          </h1>
          <p className={styles.pageSub}>
            {c.receptorNombre ?? "Consumidor final"} · {documentoReceptor(c)} ·{" "}
            {formatFecha(c.fecha)}
            {c.formaPago ? ` · ${FORMAS_DE_PAGO[c.formaPago]}` : null}
          </p>
          {cliente ? (
            <p className={styles.pageSub}>
              Cliente: <Link href={`/admin/clientes/${cliente.id}`}>{cliente.nombre}</Link>
            </p>
          ) : null}
        </div>
        <Link href="/admin/facturacion/manual" className={styles.btn}>
          Nueva factura
        </Link>
      </div>

      <AvisoEmitiendo comps={comps} />
      <section className={`${styles.card} ${styles.cardTight}`} style={{ marginBottom: 18 }}>
        <TablaComprobantes comps={comps} />
      </section>

      <section className={`${styles.card} ${styles.cardTight}`}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Renglón</th>
                <th scope="col" className={propios.importe}>
                  Cant.
                </th>
                <th scope="col" className={propios.importe}>
                  Precio
                </th>
                <th scope="col" className={propios.importe}>
                  Dto.
                </th>
                <th scope="col" className={propios.importe}>
                  Subtotal
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td>
                    <span className={styles.cellName}>{it.descripcion}</span>
                    {it.productoId ? (
                      <span className={styles.cellDim}>
                        <Link href={`/admin/productos/${it.productoId}`}>Ver producto</Link>
                      </span>
                    ) : null}
                  </td>
                  <td data-label="Cant." className={propios.importe}>
                    {it.cantidad}
                  </td>
                  <td data-label="Precio" className={propios.importe}>
                    {formatARS(it.precioUnitarioCentavos)}
                  </td>
                  <td data-label="Dto." className={propios.importe}>
                    {it.descuentoPct ? `${String(it.descuentoPct).replace(".", ",")}%` : "—"}
                  </td>
                  <td data-label="Subtotal" className={propios.importe}>
                    {formatARS(it.subtotalCentavos)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={propios.resumen} style={{ padding: "12px 16px" }}>
          {(c.tributos ?? []).map((p) => (
            <span key={p.tipo}>
              Percepción IVA RG 5329 {formatARS(p.montoCentavos)} (3% s/ {formatARS(p.baseCentavos)})
            </span>
          ))}
          <strong>Total {formatARS(c.totalCentavos)}</strong>
        </p>
      </section>
    </>
  );
}
