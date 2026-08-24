import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireUserManager, ROLE_LABEL } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import styles from "../../admin.module.css";

export const metadata = { title: "Usuarios" };

/**
 * No hay borrar, sólo desactivar.
 *
 * Es a propósito. En cuanto los usuarios empiecen a tener cosas colgando
 * —quién cargó un precio, quién despachó un pedido— borrar una fila deja
 * huérfano todo ese historial. Desactivar corta el acceso igual de rápido y
 * no rompe nada hacia atrás.
 */
export default async function UsuariosPage() {
  const actor = await requireUserManager();

  const lista = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.createdAt));

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>Usuarios</h1>
          <p className={styles.pageSub}>
            Quién entra al panel y qué puede hacer. Son las cuentas del sistema,
            no los clientes de la vinoteca.
          </p>
        </div>
        <Link
          href="/admin/usuarios/nuevo"
          className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`}
        >
          Nuevo usuario
        </Link>
      </div>

      <section className={`${styles.card} ${styles.cardTight}`}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Persona</th>
                <th scope="col">Rol</th>
                <th scope="col">Estado</th>
                <th scope="col">Último ingreso</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {lista.map((u) => (
                <tr key={u.id}>
                  <td>
                    <span className={styles.cellName}>
                      {u.name}
                      {u.id === actor.id ? (
                        <span className={styles.you}>vos</span>
                      ) : null}
                    </span>
                    <span className={styles.cellMail}>{u.email}</span>
                  </td>
                  <td>
                    <span
                      className={`${styles.badge} ${
                        u.role === "admin" ? styles.badgeAdmin : ""
                      }`}
                    >
                      {ROLE_LABEL[u.role]}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`${styles.badge} ${
                        u.isActive ? styles.badgeOn : styles.badgeOff
                      }`}
                    >
                      {u.isActive ? "Activo" : "Desactivado"}
                    </span>
                  </td>
                  <td className={styles.cellDim}>
                    {formatDateTime(u.lastLoginAt)}
                  </td>
                  <td className={styles.cellRight}>
                    <Link
                      href={`/admin/usuarios/${u.id}`}
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
      </section>
    </>
  );
}
