import Link from "next/link";
import { canManageUsers, requireUser, ROLE_LABEL } from "@/lib/auth";
import { logoutAction } from "./actions";
import { NavLinks } from "./nav-links";
import styles from "../admin.module.css";

/**
 * Marco del panel y primera barrera de acceso.
 *
 * `requireUser()` corre acá para no renderizar el marco a un desconocido,
 * pero no es el único control: cada página y cada acción vuelven a pedirlo.
 * En el App Router un layout puede no re-ejecutarse en una navegación del
 * lado del cliente, así que apoyar la seguridad sólo en él sería frágil.
 */
export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className={styles.panel}>
      <aside className={styles.sidebar}>
        <Link href="/admin" className={styles.sidebarBrand}>
          Gorros Wine
        </Link>

        <NavLinks showUsers={canManageUsers(user)} />

        <div className={styles.sidebarFoot}>
          <span className={styles.whoName}>{user.name}</span>
          <span className={styles.whoRole}>{ROLE_LABEL[user.role]}</span>
          <form action={logoutAction}>
            <button
              type="submit"
              className={`${styles.btn} ${styles.btnSmall}`}
              style={{ marginTop: 12 }}
            >
              Salir
            </button>
          </form>
        </div>
      </aside>

      <main className={styles.main}>{children}</main>
    </div>
  );
}
