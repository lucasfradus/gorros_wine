import Link from "next/link";
import { asc, count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { productoVarietales, varietales } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { crearVarietalAction } from "./actions";
import { NuevoVarietalForm } from "./varietal-forms";
import styles from "../../admin.module.css";

export const metadata = { title: "Varietales" };

export default async function VarietalesPage() {
  await requireUser();

  const lista = await db
    .select({
      id: varietales.id,
      nombre: varietales.nombre,
      slug: varietales.slug,
      isActive: varietales.isActive,
      usos: count(productoVarietales.productoId),
    })
    .from(varietales)
    .leftJoin(
      productoVarietales,
      eq(productoVarietales.varietalId, varietales.id),
    )
    .groupBy(varietales.id)
    .orderBy(asc(varietales.nombre));

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>Varietales</h1>
          <p className={styles.pageSub}>
            Las uvas que se pueden elegir al cargar un vino. Lista cerrada a
            propósito: con texto libre terminan conviviendo &ldquo;Malbec&rdquo;,
            &ldquo;malbec&rdquo; y &ldquo;MALBEC&rdquo; como tres uvas distintas.
          </p>
        </div>
      </div>

      <div className={styles.stack}>
        <section className={styles.card}>
          <h2 className={`${styles.label} ${styles.sectionHead}`}>
            Agregar varietal
          </h2>
          <NuevoVarietalForm action={crearVarietalAction} />
        </section>

        <section className={`${styles.card} ${styles.cardTight}`}>
          {lista.length === 0 ? (
            <p className={styles.empty}>Todavía no hay varietales cargados.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Varietal</th>
                    <th scope="col">Vinos</th>
                    <th scope="col">Estado</th>
                    <th scope="col" />
                  </tr>
                </thead>
                <tbody>
                  {lista.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <span className={styles.cellName}>{v.nombre}</span>
                        <span className={styles.cellMail}>{v.slug}</span>
                      </td>
                      <td className={styles.cellDim}>{v.usos}</td>
                      <td>
                        <span
                          className={`${styles.badge} ${
                            v.isActive ? styles.badgeOn : styles.badgeOff
                          }`}
                        >
                          {v.isActive ? "Activo" : "Archivado"}
                        </span>
                      </td>
                      <td className={styles.cellRight}>
                        <Link
                          href={`/admin/varietales/${v.id}`}
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
      </div>
    </>
  );
}
