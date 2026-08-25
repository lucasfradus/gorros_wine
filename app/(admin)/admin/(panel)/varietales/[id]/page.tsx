import Link from "next/link";
import { notFound } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { productoVarietales, varietales } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { archivarVarietalAction, editarVarietalAction } from "../actions";
import { ArchivarVarietalForm, VarietalForm } from "../varietal-forms";
import styles from "../../../admin.module.css";

export const metadata = { title: "Editar varietal" };

export default async function EditarVarietalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();

  if (!z.uuid().safeParse(id).success) notFound();

  const [varietal] = await db
    .select()
    .from(varietales)
    .where(eq(varietales.id, id))
    .limit(1);

  if (!varietal) notFound();

  const [enUso] = await db
    .select({ n: count() })
    .from(productoVarietales)
    .where(eq(productoVarietales.varietalId, id));

  return (
    <>
      <Link href="/admin/varietales" className={styles.backLink}>
        ← Varietales
      </Link>

      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>{varietal.nombre}</h1>
          <p className={styles.pageSub}>
            {enUso.n === 0
              ? "Todavía no lo usa ningún vino."
              : `Lo usan ${enUso.n} ${enUso.n === 1 ? "vino" : "vinos"}.`}
          </p>
        </div>
      </div>

      <div className={styles.stack}>
        <section className={styles.card}>
          <h2 className={`${styles.label} ${styles.sectionHead}`}>Datos</h2>
          <VarietalForm action={editarVarietalAction} defaults={varietal} />
        </section>

        <section className={styles.card}>
          <h2 className={`${styles.label} ${styles.sectionHead}`}>Estado</h2>
          <ArchivarVarietalForm
            action={archivarVarietalAction}
            varietalId={varietal.id}
            isActive={varietal.isActive}
            enUso={enUso.n}
          />
        </section>

        <section className={styles.card}>
          <h2 className={`${styles.label} ${styles.sectionHead}`}>Historial</h2>
          <ul className={styles.metaList}>
            <li>
              <span className={styles.metaLabel}>Creado</span>
              {formatDateTime(varietal.createdAt)}
            </li>
            <li>
              <span className={styles.metaLabel}>Última edición</span>
              {formatDateTime(varietal.updatedAt)}
            </li>
          </ul>
        </section>
      </div>
    </>
  );
}
