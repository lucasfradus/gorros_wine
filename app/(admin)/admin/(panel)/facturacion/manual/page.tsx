import { randomUUID } from "node:crypto";
import Link from "next/link";
import { requireFacturacion } from "@/lib/auth";
import { facturacionConfigurada } from "@/lib/facturante/config";
import { ultimasFechas } from "@/lib/facturacion/emitir";
import { hoyEnArgentina } from "@/lib/format";
import { FacturaManualForm } from "./factura-manual-form";
import { clientesParaFacturar } from "../clientes-para-facturar";
import { productosParaFacturar } from "../productos-para-facturar";
import styles from "../../../admin.module.css";

export const metadata = { title: "Nueva factura" };

export default async function FacturaManualPage() {
  await requireFacturacion();

  const [listaClientes, ultimas, productos] = await Promise.all([
    clientesParaFacturar(),
    ultimasFechas(),
    productosParaFacturar(),
  ]);

  return (
    <>
      <Link href="/admin/facturacion" className={styles.backLink}>
        ← Facturación
      </Link>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>Nueva factura</h1>
          <p className={styles.pageSub}>
            Mostrador, mayorista, transferencia. Lo cobrado por Mercado Pago se factura desde Cobros de MP.
          </p>
        </div>
      </div>

      <section className={styles.card}>
        {facturacionConfigurada() ? (
          <FacturaManualForm
            // Un id por formulario dibujado: es el del comprobante, y lo que
            // impide que un doble envío saque dos facturas.
            id={randomUUID()}
            clientes={listaClientes}
            productos={productos}
            hoy={hoyEnArgentina()}
            ultimas={ultimas}
          />
        ) : (
          <p className={styles.hint}>
            Falta la configuración de Facturante en el entorno (FACTURANTE_* y EMISOR_CUIT).
          </p>
        )}
      </section>
    </>
  );
}
