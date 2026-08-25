import Link from "next/link";
import { asc, count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bodegas, productos } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import styles from "../../admin.module.css";

export const metadata = { title: "Bodegas" };

/**
 * Las bodegas son el **proveedor**, no una etiqueta del catálogo: acá viven el
 * contacto comercial y las condiciones, que no se muestran en la tienda.
 *
 * Como en Usuarios, no hay borrar: sólo archivar. Un producto siempre cuelga
 * de una bodega, y la clave foránea es `restrict` justamente para que un
 * borrado no pueda dejar vinos huérfanos.
 */
export default async function BodegasPage() {
  await requireUser();

  const lista = await db
    .select({
      id: bodegas.id,
      nombre: bodegas.nombre,
      pais: bodegas.pais,
      contactoNombre: bodegas.contactoNombre,
      contactoEmail: bodegas.contactoEmail,
      isActive: bodegas.isActive,
      productos: count(productos.id),
    })
    .from(bodegas)
    .leftJoin(productos, eq(productos.bodegaId, bodegas.id))
    .groupBy(bodegas.id)
    .orderBy(asc(bodegas.nombre));

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>Bodegas</h1>
          <p className={styles.pageSub}>
            De quién se compra. Cada vino del catálogo cuelga de una bodega.
          </p>
        </div>
        <Link
          href="/admin/bodegas/nueva"
          className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`}
        >
          Nueva bodega
        </Link>
      </div>

      <section className={`${styles.card} ${styles.cardTight}`}>
        {lista.length === 0 ? (
          <p className={styles.empty}>
            Todavía no hay ninguna bodega. Cargá la primera y después vas a
            poder darle de alta sus vinos.
          </p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Bodega</th>
                  <th scope="col">Contacto</th>
                  <th scope="col">Productos</th>
                  <th scope="col">Estado</th>
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {lista.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <span className={styles.cellName}>{b.nombre}</span>
                      {b.pais ? (
                        <span className={styles.cellMail}>{b.pais}</span>
                      ) : null}
                    </td>
                    <td>
                      {b.contactoNombre || b.contactoEmail ? (
                        <>
                          <span className={styles.cellName}>
                            {b.contactoNombre ?? "—"}
                          </span>
                          {b.contactoEmail ? (
                            <span className={styles.cellMail}>
                              {b.contactoEmail}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span className={styles.cellDim}>Sin cargar</span>
                      )}
                    </td>
                    <td className={styles.cellDim}>{b.productos}</td>
                    <td>
                      <span
                        className={`${styles.badge} ${
                          b.isActive ? styles.badgeOn : styles.badgeOff
                        }`}
                      >
                        {b.isActive ? "Activa" : "Archivada"}
                      </span>
                    </td>
                    <td className={styles.cellRight}>
                      <Link
                        href={`/admin/bodegas/${b.id}`}
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
