import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bodegas, categorias, cotizaciones, productos } from "@/lib/db/schema";
import type { ProductoParaFacturar } from "./renglones";

/**
 * El catálogo para el buscador de renglones (factura, presupuesto, recibo). Lo
 * de USD se pesifica con la última cotización: sin cotización cargada no hay
 * precio en pesos que proponer, y esos productos quedan afuera (se pueden
 * cargar como renglón libre).
 */
export async function productosParaFacturar(): Promise<ProductoParaFacturar[]> {
  const [catalogo, [cotizacion]] = await Promise.all([
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

  const vistos = new Map<string, number>();
  return catalogo.flatMap((p) => {
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
}
