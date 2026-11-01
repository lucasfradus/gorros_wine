import { randomUUID } from "node:crypto";
import Link from "next/link";
import { requireFacturacion } from "@/lib/auth";
import { hoyEnArgentina } from "@/lib/format";
import { clientesParaFacturar } from "../../clientes-para-facturar";
import { productosParaFacturar } from "../../productos-para-facturar";
import { DocumentoForm } from "./documento-form";
import styles from "../../../../admin.module.css";

export const metadata = { title: "Nuevo presupuesto o recibo" };

export default async function NuevoDocumentoPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  await requireFacturacion();
  const { tipo } = await searchParams;
  const [clientes, productos] = await Promise.all([clientesParaFacturar(), productosParaFacturar()]);

  return (
    <>
      <Link href="/admin/facturacion/documentos" className={styles.backLink}>
        ← Presupuestos y recibos
      </Link>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>Nuevo presupuesto o recibo</h1>
          <p className={styles.pageSub}>
            Sin validez fiscal. Para imprimir o mandar como PDF, y facturarlo después.
          </p>
        </div>
      </div>

      <section className={styles.card}>
        <DocumentoForm
          // El id del documento: un doble envío choca con la PK.
          id={randomUUID()}
          tipoInicial={tipo === "recibo" ? "recibo" : "presupuesto"}
          clientes={clientes}
          productos={productos}
          hoy={hoyEnArgentina()}
        />
      </section>
    </>
  );
}
