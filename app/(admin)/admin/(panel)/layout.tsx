import Link from "next/link";
import {
  canFacturar,
  canManageUsers,
  requireUser,
  ROLE_LABEL,
} from "@/lib/auth";
import { getTheme } from "@/lib/theme-server";
import { logoutAction } from "./actions";
import { NavLinks } from "./nav-links";
import { PanelShell } from "./panel-shell";
import { ThemeSwitch } from "../theme-switch";
import styles from "../admin.module.css";

/**
 * Marco del panel y primera barrera de acceso.
 *
 * `requireUser()` corre acá para no renderizar el marco a un desconocido,
 * pero no es el único control: cada página y cada acción vuelven a pedirlo.
 * En el App Router un layout puede no re-ejecutarse en una navegación del
 * lado del cliente, así que apoyar la seguridad sólo en él sería frágil.
 *
 * El modo visual se resuelve en el servidor y sale ya aplicado en el HTML:
 * quien eligió el modo claro nunca ve un destello oscuro al cargar.
 */
export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, theme] = await Promise.all([requireUser(), getTheme()]);

  return (
    <div className={`${styles.themed} ${styles.panel}`} data-theme={theme}>
      <PanelShell
        sidebar={
          <>
            <Link href="/admin" className={styles.sidebarBrand}>
              <span className={styles.brandTile} aria-hidden="true">
                G
              </span>
              <span className={styles.brandText}>
                Gorros Wine
                <span className={styles.brandSub}>Administración</span>
              </span>
            </Link>

            <NavLinks
              showUsers={canManageUsers(user)}
              showFacturacion={canFacturar(user)}
            />

            <div className={styles.sidebarFoot}>
              <div className={styles.who}>
                <span className={styles.whoText}>
                  <span className={styles.whoName}>{user.name}</span>
                  <span className={styles.whoRole}>
                    {ROLE_LABEL[user.role]}
                  </span>
                </span>

                <form action={logoutAction}>
                  <button
                    type="submit"
                    className={`${styles.btn} ${styles.btnSmall}`}
                  >
                    Salir
                  </button>
                </form>
              </div>

              <ThemeSwitch current={theme} />
            </div>
          </>
        }
      >
        {children}
      </PanelShell>
    </div>
  );
}
