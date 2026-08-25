import Link from "next/link";
import { asc, count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { categorias, productos } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import styles from "../../admin.module.css";

export const metadata = { title: "Categorías" };

/**
 * El listado se muestra como árbol: cada principal seguida de sus
 * subcategorías. Se arma acá, en memoria, y no con una consulta recursiva —
 * son dos niveles y un puñado de filas; un `WITH RECURSIVE` para eso es
 * maquinaria de más.
 */
export default async function CategoriasPage() {
  await requireUser();

  const filas = await db
    .select({
      id: categorias.id,
      nombre: categorias.nombre,
      slug: categorias.slug,
      parentId: categorias.parentId,
      orden: categorias.orden,
      esVino: categorias.esVino,
      isActive: categorias.isActive,
      productos: count(productos.id),
    })
    .from(categorias)
    .leftJoin(productos, eq(productos.categoriaId, categorias.id))
    .groupBy(categorias.id)
    .orderBy(asc(categorias.orden), asc(categorias.nombre));

  const raices = filas.filter((c) => c.parentId === null);
  const enOrden = raices.flatMap((raiz) => [
    { fila: raiz, esHija: false },
    ...filas
      .filter((c) => c.parentId === raiz.id)
      .map((hija) => ({ fila: hija, esHija: true })),
  ]);

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>Categorías</h1>
          <p className={styles.pageSub}>
            Qué clase de cosa es cada producto. La categoría decide qué ficha se
            le pide: sólo las de vino piden bodega, varietales y añada.
          </p>
        </div>
        <Link
          href="/admin/categorias/nueva"
          className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`}
        >
          Nueva categoría
        </Link>
      </div>

      <section className={`${styles.card} ${styles.cardTight}`}>
        {enOrden.length === 0 ? (
          <p className={styles.empty}>Todavía no hay categorías.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Categoría</th>
                  <th scope="col">Ficha</th>
                  <th scope="col">Productos</th>
                  <th scope="col">Estado</th>
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {enOrden.map(({ fila, esHija }) => (
                  <tr key={fila.id}>
                    <td className={esHija ? styles.cellNested : undefined}>
                      <span className={styles.cellName}>
                        {esHija ? "└ " : ""}
                        {fila.nombre}
                      </span>
                      <span className={styles.cellMail}>{fila.slug}</span>
                    </td>
                    <td className={styles.cellDim}>
                      {fila.esVino ? "Vino" : "Corta"}
                    </td>
                    <td className={styles.cellDim}>{fila.productos}</td>
                    <td>
                      <span
                        className={`${styles.badge} ${
                          fila.isActive ? styles.badgeOn : styles.badgeOff
                        }`}
                      >
                        {fila.isActive ? "Activa" : "Archivada"}
                      </span>
                    </td>
                    <td className={styles.cellRight}>
                      <Link
                        href={`/admin/categorias/${fila.id}`}
                        className={`${styles.btn} ${styles.btnSmall}`}
                      >
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
