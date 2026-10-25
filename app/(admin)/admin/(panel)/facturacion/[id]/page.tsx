import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { comprobantes, movimientosMp } from "@/lib/db/schema";
import { requireFacturacion } from "@/lib/auth";
import { formatARS, formatDateTime } from "@/lib/format";
import { facturacionConfigurada } from "@/lib/facturante/config";
import {
  sePuedeFacturar,
  situacionDe,
  type ComprobanteResumen,
} from "@/lib/facturacion/estado";
import { AutoRefresh } from "../auto-refresh";
import { EmitirForm, type DatosIniciales } from "../emitir-form";
import { TablaComprobantes } from "../tabla-comprobantes";
import { clientesParaFacturar } from "../clientes-para-facturar";
import styles from "../../../admin.module.css";
import propios from "../facturacion.module.css";

export const metadata = { title: "Facturar cobro" };

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

  const listaClientes = facturable
    ? await clientesParaFacturar()
    : [];

  return (
    <>
      <AutoRefresh activo={enCamino} />
      <Link href="/admin/facturacion/cobros" className={styles.backLink}>
        ← Cobros de Mercado Pago
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
          <TablaComprobantes comps={comps} />
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
              clientes={listaClientes}
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
