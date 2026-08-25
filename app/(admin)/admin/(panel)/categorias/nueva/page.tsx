import Link from "next/link";
import { asc, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { categorias } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { crearCategoriaAction } from "../actions";
import { CategoriaForm } from "../categoria-forms";
import styles from "../../../admin.module.css";

export const metadata = { title: "Nueva categoría" };

export default async function NuevaCategoriaPage() {
  await requireUser();

  // Sólo las raíces pueden ser padre: no hay tercer nivel.
  const padres = await db
    .select({
      id: categorias.id,
      nombre: categorias.nombre,
      esVino: categorias.esVino,
    })
    .from(categorias)
    .where(isNull(categorias.parentId))
    .orderBy(asc(categorias.orden), asc(categorias.nombre));

  return (
    <>
      <Link href="/admin/categorias" className={styles.backLink}>
        ← Categorías
      </Link>

      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>Nueva categoría</h1>
          <p className={styles.pageSub}>
            Una categoría principal, o una subcategoría de una que ya exista.
          </p>
        </div>
      </div>

      <section className={styles.card}>
        <CategoriaForm
          action={crearCategoriaAction}
          padresPosibles={padres}
          submitLabel="Crear categoría"
        />
      </section>
    </>
  );
}
