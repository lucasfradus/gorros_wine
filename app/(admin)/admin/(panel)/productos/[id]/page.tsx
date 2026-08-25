import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  bodegas,
  productoVarietales,
  productos,
  varietales,
} from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { opcionesDeCategoria } from "@/lib/categorias";
import { formatDateTime } from "@/lib/format";
import { aPesos, formatearPrecio } from "@/lib/precio";
import { cotizacionVigente } from "@/lib/cotizacion";
import { archivarProductoAction, editarProductoAction } from "../actions";
import { ArchivarProductoForm, ProductoForm } from "../producto-forms";
import styles from "../../../admin.module.css";

export const metadata = { title: "Editar producto" };

export default async function EditarProductoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();

  // Sin este filtro, un id que no es UUID llega a Postgres y revienta la
  // consulta en vez de dar un 404 limpio.
  if (!z.uuid().safeParse(id).success) notFound();

  const [producto] = await db
    .select()
    .from(productos)
    .where(eq(productos.id, id))
    .limit(1);

  if (!producto) notFound();

  const suyos = await db
    .select({ varietalId: productoVarietales.varietalId })
    .from(productoVarietales)
    .where(eq(productoVarietales.productoId, id));

  const varietalIds = suyos.map((v) => v.varietalId);

  const [categoriasOpciones, listaBodegas, listaVarietales, cotizacion] =
    await Promise.all([
      opcionesDeCategoria(producto.categoriaId),
      // Las activas, más la propia aunque esté archivada: si no, al guardar
      // cualquier otro cambio el `<select>` mandaría una bodega distinta.
      db
        .select({ id: bodegas.id, nombre: bodegas.nombre })
        .from(bodegas)
        .where(
          producto.bodegaId
            ? or(eq(bodegas.isActive, true), eq(bodegas.id, producto.bodegaId))
            : eq(bodegas.isActive, true),
        )
        .orderBy(asc(bodegas.nombre)),
      // Idem con los varietales: uno archivado que este vino ya tiene cargado
      // tiene que seguir apareciendo, o al guardar se perdería.
      db
        .select({ id: varietales.id, nombre: varietales.nombre })
        .from(varietales)
        .where(
          varietalIds.length
            ? or(
                eq(varietales.isActive, true),
                inArray(varietales.id, varietalIds),
              )
            : eq(varietales.isActive, true),
        )
        .orderBy(asc(varietales.nombre)),
      cotizacionVigente(),
    ]);

  const enPesos = aPesos(
    producto.precioCentavos,
    producto.moneda,
    cotizacion?.arsPorUsdCentavos ?? null,
  );

  return (
    <>
      <Link href="/admin/productos" className={styles.backLink}>
        ← Productos
      </Link>

      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>{producto.nombre}</h1>
          <p className={styles.pageSub}>
            {formatearPrecio(producto.precioCentavos, producto.moneda)}
            {producto.moneda === "USD" && enPesos !== null
              ? ` · ≈ ${formatearPrecio(enPesos, "ARS")}`
              : ""}
            {producto.stock === 0
              ? " · sin stock"
              : ` · ${producto.stock} en stock`}
          </p>
        </div>
      </div>

      <div className={styles.stack}>
        <section className={styles.card}>
          <h2 className={`${styles.label} ${styles.sectionHead}`}>Datos</h2>
          <ProductoForm
            action={editarProductoAction}
            categoriasOpciones={categoriasOpciones}
            bodegasOpciones={listaBodegas}
            varietalesOpciones={listaVarietales}
            cotizacion={cotizacion?.arsPorUsdCentavos ?? null}
            defaults={{ ...producto, varietalIds }}
            submitLabel="Guardar cambios"
          />
        </section>

        <section className={styles.card}>
          <h2 className={`${styles.label} ${styles.sectionHead}`}>Estado</h2>
          <ArchivarProductoForm
            action={archivarProductoAction}
            productoId={producto.id}
            isActive={producto.isActive}
          />
        </section>

        <section className={styles.card}>
          <h2 className={`${styles.label} ${styles.sectionHead}`}>Historial</h2>
          <ul className={styles.metaList}>
            <li>
              <span className={styles.metaLabel}>Creado</span>
              {formatDateTime(producto.createdAt)}
            </li>
            <li>
              <span className={styles.metaLabel}>Última edición</span>
              {formatDateTime(producto.updatedAt)}
            </li>
            <li>
              <span className={styles.metaLabel}>Slug</span>
              {producto.slug}
            </li>
          </ul>
        </section>
      </div>
    </>
  );
}
