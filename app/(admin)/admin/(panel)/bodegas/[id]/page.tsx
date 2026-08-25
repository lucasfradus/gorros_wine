import Link from "next/link";
import { notFound } from "next/navigation";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { bodegas, productos } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { archivarBodegaAction, editarBodegaAction } from "../actions";
import { ArchivarBodegaForm, BodegaForm } from "../bodega-forms";
import styles from "../../../admin.module.css";

export const metadata = { title: "Editar bodega" };

export default async function EditarBodegaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();

  // Sin este filtro, un id que no es UUID llega a Postgres y revienta la
  // consulta en vez de dar un 404 limpio.
  if (!z.uuid().safeParse(id).success) notFound();

  const [bodega] = await db
    .select()
    .from(bodegas)
    .where(eq(bodegas.id, id))
    .limit(1);

  if (!bodega) notFound();

  const [total] = await db
    .select({ n: count() })
    .from(productos)
    .where(eq(productos.bodegaId, bodega.id));

  const [activos] = await db
    .select({ n: count() })
    .from(productos)
    .where(and(eq(productos.bodegaId, bodega.id), eq(productos.isActive, true)));

  return (
    <>
      <Link href="/admin/bodegas" className={styles.backLink}>
        ← Bodegas
      </Link>

      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>{bodega.nombre}</h1>
          <p className={styles.pageSub}>
            {total.n === 0
              ? "Todavía sin productos cargados."
              : `${total.n} ${total.n === 1 ? "producto" : "productos"}, ${activos.n} ${activos.n === 1 ? "activo" : "activos"}.`}
          </p>
        </div>
        {total.n > 0 ? (
          <Link
            href={`/admin/productos?bodega=${bodega.id}`}
            className={`${styles.btn} ${styles.btnSmall}`}
          >
            Ver sus productos
          </Link>
        ) : null}
      </div>

      <div className={styles.stack}>
        <section className={styles.card}>
          <h2 className={`${styles.label} ${styles.sectionHead}`}>Datos</h2>
          <BodegaForm
            action={editarBodegaAction}
            defaults={bodega}
            submitLabel="Guardar cambios"
          />
        </section>

        <section className={styles.card}>
          <h2 className={`${styles.label} ${styles.sectionHead}`}>Estado</h2>
          <ArchivarBodegaForm
            action={archivarBodegaAction}
            bodegaId={bodega.id}
            isActive={bodega.isActive}
            productosActivos={activos.n}
          />
        </section>

        <section className={styles.card}>
          <h2 className={`${styles.label} ${styles.sectionHead}`}>Historial</h2>
          <ul className={styles.metaList}>
            <li>
              <span className={styles.metaLabel}>Creada</span>
              {formatDateTime(bodega.createdAt)}
            </li>
            <li>
              <span className={styles.metaLabel}>Última edición</span>
              {formatDateTime(bodega.updatedAt)}
            </li>
            <li>
              <span className={styles.metaLabel}>Slug</span>
              {bodega.slug}
            </li>
          </ul>
        </section>
      </div>
    </>
  );
}
