import { randomUUID } from "node:crypto";
import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bodegas, categorias, cotizaciones, productos } from "@/lib/db/schema";
import { requireFacturacion } from "@/lib/auth";
import { facturacionConfigurada } from "@/lib/facturante/config";
import { FacturaManualForm, type ProductoParaFacturar } from "./factura-manual-form";
import { clientesParaFacturar } from "../clientes-para-facturar";
import styles from "../../../admin.module.css";

export const metadata = { title: "Nueva factura" };

export default async function FacturaManualPage() {
  await requireFacturacion();

  const [listaClientes, catalogo, [cotizacion]] = await Promise.all([
    clientesParaFacturar(),
    db
      .select({
        id: productos.id,
        nombre: productos.nombre,
        anada: productos.anada,
        volumenMl: productos.volumenMl,
        precioCentavos: productos.precioCentavos,
        moneda: productos.moneda,
        bodega: bodegas.nombre,
        esVino: categorias.esVino,
      })
      .from(productos)
      .leftJoin(bodegas, eq(bodegas.id, productos.bodegaId))
      .leftJoin(categorias, eq(categorias.id, productos.categoriaId))
      .where(eq(productos.isActive, true))
      .orderBy(asc(productos.nombre)),
    db
      .select({ arsPorUsdCentavos: cotizaciones.arsPorUsdCentavos })
      .from(cotizaciones)
      .orderBy(desc(cotizaciones.createdAt))
      .limit(1),
  ]);

  // El catálogo para el buscador. Lo de USD se pesifica con la última
  // cotización: sin cotización cargada no hay precio en pesos que proponer, y
  // esos productos quedan afuera (se pueden facturar como renglón libre).
  const vistos = new Map<string, number>();
  const productosParaFacturar: ProductoParaFacturar[] = catalogo.flatMap((p) => {
    const enUsd = p.moneda === "USD";
    if (enUsd && !cotizacion) return [];
    const base = [
      p.nombre,
      p.bodega,
      p.anada ? String(p.anada) : null,
      p.volumenMl && p.volumenMl !== 750 ? `${p.volumenMl} ml` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    // La etiqueta es lo que identifica al producto en el buscador: dos iguales
    // se distinguen con un número.
    const n = (vistos.get(base) ?? 0) + 1;
    vistos.set(base, n);
    return [
      {
        id: p.id,
        etiqueta: n > 1 ? `${base} (${n})` : base,
        precioCentavos: enUsd
          ? Math.round((p.precioCentavos * cotizacion!.arsPorUsdCentavos) / 100)
          : p.precioCentavos,
        precioUsdCentavos: enUsd ? p.precioCentavos : null,
        alcanzado: p.esVino ?? false,
      },
    ];
  });

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
            productos={productosParaFacturar}
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
