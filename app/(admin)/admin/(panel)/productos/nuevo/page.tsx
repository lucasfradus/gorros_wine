import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bodegas, varietales } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { opcionesDeCategoria } from "@/lib/categorias";
import { cotizacionVigente } from "@/lib/cotizacion";
import { crearProductoAction } from "../actions";
import { ProductoForm } from "../producto-forms";
import styles from "../../../admin.module.css";

export const metadata = { title: "Nuevo producto" };

export default async function NuevoProductoPage() {
  await requireUser();

  // Sólo lo activo: cargar algo nuevo contra una bodega o un varietal
  // archivado es casi siempre un error. En la edición sí se siguen viendo,
  // porque ahí el dato es histórico.
  const [categoriasOpciones, listaBodegas, listaVarietales, cotizacion] =
    await Promise.all([
      opcionesDeCategoria(),
      db
        .select({ id: bodegas.id, nombre: bodegas.nombre })
        .from(bodegas)
        .where(eq(bodegas.isActive, true))
        .orderBy(asc(bodegas.nombre)),
      db
        .select({ id: varietales.id, nombre: varietales.nombre })
        .from(varietales)
        .where(eq(varietales.isActive, true))
        .orderBy(asc(varietales.nombre)),
      cotizacionVigente(),
    ]);

  // Sin categorías no hay producto posible: la columna es NOT NULL.
  if (categoriasOpciones.length === 0) redirect("/admin/categorias/nueva");

  return (
    <>
      <Link href="/admin/productos" className={styles.backLink}>
        ← Productos
      </Link>

      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>Nuevo producto</h1>
          <p className={styles.pageSub}>
            Empezá por la categoría: es la que decide si el formulario pide
            ficha de vino o la corta.
          </p>
        </div>
      </div>

      <section className={styles.card}>
        <ProductoForm
          action={crearProductoAction}
          categoriasOpciones={categoriasOpciones}
          bodegasOpciones={listaBodegas}
          varietalesOpciones={listaVarietales}
          cotizacion={cotizacion?.arsPorUsdCentavos ?? null}
          submitLabel="Crear producto"
        />
      </section>
    </>
  );
}
