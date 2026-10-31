import { randomUUID } from "node:crypto";
import Link from "next/link";
import { requireFacturacion } from "@/lib/auth";
import { facturacionConfigurada } from "@/lib/facturante/config";
import { ultimasFechas } from "@/lib/facturacion/emitir";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { comprobantes } from "@/lib/db/schema";
import {
  NOMBRE_DOCUMENTO,
  documentoConItems,
  facturaViva,
  numeroDocumento,
} from "@/lib/facturacion/documentos";
import { formatFecha, hoyEnArgentina } from "@/lib/format";
import type { DatosIniciales } from "../receptor-campos";
import { FacturaManualForm } from "./factura-manual-form";
import { clientesParaFacturar } from "../clientes-para-facturar";
import { productosParaFacturar } from "../productos-para-facturar";
import styles from "../../../admin.module.css";

export const metadata = { title: "Nueva factura" };

/** El receptor de un documento sin cliente: lo tipeado, con el documento
 *  interpretado por cantidad de dígitos (11 es CUIT; 7 u 8, DNI). */
function receptorDe(nombre: string | null, documento: string | null): DatosIniciales {
  const d = (documento ?? "").replace(/\D/g, "");
  const docTipo = d.length === 11 ? "cuit" : d.length === 7 || d.length === 8 ? "dni" : "ninguno";
  return { nombre: nombre ?? "", email: "", docTipo, docNumero: docTipo === "ninguno" ? "" : d };
}

export default async function FacturaManualPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string }>;
}) {
  await requireFacturacion();
  const { desde: desdeId } = await searchParams;

  const [listaClientes, ultimas, productos, origen] = await Promise.all([
    clientesParaFacturar(),
    ultimasFechas(),
    productosParaFacturar(),
    desdeId && /^[0-9a-f-]{36}$/i.test(desdeId) ? documentoConItems(desdeId) : null,
  ]);

  // Un presupuesto o recibo que se pasa a factura: sus renglones y su receptor
  // precargados, todo editable. Uno anulado o ya facturado se avisa en vez de
  // precargarse; igual lo vuelve a chequear la reserva.
  const [facturaPrevia] = origen?.doc.facturaId
    ? await db
        .select({ estado: comprobantes.estado })
        .from(comprobantes)
        .where(eq(comprobantes.id, origen.doc.facturaId))
        .limit(1)
    : [];
  const noFacturable = origen && (origen.doc.anulado || facturaViva(facturaPrevia?.estado));
  const desde =
    origen && !noFacturable
      ? {
          documentoId: origen.doc.id,
          renglones: origen.items.map((it) => ({
            productoId: it.productoId,
            descripcion: it.descripcion,
            cantidad: it.cantidad,
            precioUnitarioCentavos: it.precioUnitarioCentavos,
            descuentoPct: it.descuentoPct,
            // Como al cargarlo a mano: lo del catálogo según su categoría, lo
            // libre como bebida.
            alcanzado: productos.find((p) => p.id === it.productoId)?.alcanzado ?? true,
          })),
          cliente: listaClientes.find((c) => c.id === origen.doc.clienteId) ?? null,
          receptor: receptorDe(origen.doc.receptorNombre, origen.doc.receptorDocumento),
        }
      : undefined;

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

      {origen ? (
        <p
          className={`${styles.alert} ${noFacturable ? styles.alertError : styles.alertOk}`}
          style={{ marginBottom: 18 }}
        >
          {noFacturable
            ? `El ${NOMBRE_DOCUMENTO[origen.doc.tipo].toLowerCase()} N° ${numeroDocumento(origen.doc.numero)} ya se facturó o está anulado.`
            : `Desde el ${NOMBRE_DOCUMENTO[origen.doc.tipo].toLowerCase()} N° ${numeroDocumento(origen.doc.numero)} del ${formatFecha(origen.doc.fecha)}: revisá el receptor y la fecha antes de emitir.`}
        </p>
      ) : null}

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
            desde={desde}
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
