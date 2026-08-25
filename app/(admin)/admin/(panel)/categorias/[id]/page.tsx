import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, count, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { categorias, productos } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { archivarCategoriaAction, editarCategoriaAction } from "../actions";
import { ArchivarCategoriaForm, CategoriaForm } from "../categoria-forms";
import styles from "../../../admin.module.css";

export const metadata = { title: "Editar categoría" };

export default async function EditarCategoriaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();

  if (!z.uuid().safeParse(id).success) notFound();

  const [categoria] = await db
    .select()
    .from(categorias)
    .where(eq(categorias.id, id))
    .limit(1);

  if (!categoria) notFound();

  const [padres, [total], [activos], [hijas]] = await Promise.all([
    // Raíces, menos ella misma: no puede ser su propia subcategoría.
    db
      .select({
        id: categorias.id,
        nombre: categorias.nombre,
        esVino: categorias.esVino,
      })
      .from(categorias)
      .where(and(isNull(categorias.parentId), ne(categorias.id, id)))
      .orderBy(asc(categorias.orden), asc(categorias.nombre)),
    db
      .select({ n: count() })
      .from(productos)
      .where(eq(productos.categoriaId, id)),
    db
      .select({ n: count() })
      .from(productos)
      .where(and(eq(productos.categoriaId, id), eq(productos.isActive, true))),
    db
      .select({ n: count() })
      .from(categorias)
      .where(eq(categorias.parentId, id)),
  ]);

  return (
    <>
      <Link href="/admin/categorias" className={styles.backLink}>
        ← Categorías
      </Link>

      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>{categoria.nombre}</h1>
          <p className={styles.pageSub}>
            {categoria.esVino ? "Ficha de vino" : "Ficha corta"} ·{" "}
            {total.n === 0
              ? "sin productos"
              : `${total.n} ${total.n === 1 ? "producto" : "productos"}`}
            {hijas.n > 0
              ? ` · ${hijas.n} ${hijas.n === 1 ? "subcategoría" : "subcategorías"}`
              : ""}
          </p>
        </div>
        {total.n > 0 ? (
          <Link
            href={`/admin/productos?categoria=${categoria.id}`}
            className={`${styles.btn} ${styles.btnSmall}`}
          >
            Ver sus productos
          </Link>
        ) : null}
      </div>

      <div className={styles.stack}>
        <section className={styles.card}>
          <h2 className={`${styles.label} ${styles.sectionHead}`}>Datos</h2>
          <CategoriaForm
            action={editarCategoriaAction}
            padresPosibles={padres}
            defaults={categoria}
            submitLabel="Guardar cambios"
          />
        </section>

        <section className={styles.card}>
          <h2 className={`${styles.label} ${styles.sectionHead}`}>Estado</h2>
          <ArchivarCategoriaForm
            action={archivarCategoriaAction}
            categoriaId={categoria.id}
            isActive={categoria.isActive}
            productosActivos={activos.n}
            subcategorias={hijas.n}
          />
        </section>

        <section className={styles.card}>
          <h2 className={`${styles.label} ${styles.sectionHead}`}>Historial</h2>
          <ul className={styles.metaList}>
            <li>
              <span className={styles.metaLabel}>Creada</span>
              {formatDateTime(categoria.createdAt)}
            </li>
            <li>
              <span className={styles.metaLabel}>Última edición</span>
              {formatDateTime(categoria.updatedAt)}
            </li>
            <li>
              <span className={styles.metaLabel}>Slug</span>
              {categoria.slug}
            </li>
          </ul>
        </section>
      </div>
    </>
  );
}
