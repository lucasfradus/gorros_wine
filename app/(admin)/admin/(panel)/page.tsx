import Link from "next/link";
import { count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { canManageUsers, requireUser } from "@/lib/auth";
import { wines } from "@/lib/data";
import styles from "../admin.module.css";

export const metadata = { title: "Inicio" };

export default async function DashboardPage() {
  const user = await requireUser();
  const puedeUsuarios = canManageUsers(user);

  const [activos] = puedeUsuarios
    ? await db
        .select({ n: count() })
        .from(users)
        .where(eq(users.isActive, true))
    : [{ n: 0 }];

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>Hola, {user.name.split(" ")[0]}</h1>
          <p className={styles.pageSub}>
            Panel de administración de Gorros Wine.
          </p>
        </div>
      </div>

      <div className={styles.stack}>
        {puedeUsuarios ? (
          <section className={styles.card}>
            <h2 className={styles.label}>Usuarios del sistema</h2>
            <p style={{ margin: "10px 0 0", fontSize: 15 }}>
              {activos.n === 1
                ? "1 usuario activo."
                : `${activos.n} usuarios activos.`}
            </p>
            <div className={styles.btnRow} style={{ marginTop: 16 }}>
              <Link
                href="/admin/usuarios"
                className={`${styles.btn} ${styles.btnSmall}`}
              >
                Administrar
              </Link>
            </div>
          </section>
        ) : null}

        {/* Nada de métricas inventadas: el catálogo todavía no vive en la
            base, y decir lo contrario acá sería mentirle a quien lo usa. */}
        <section className={styles.card}>
          <h2 className={styles.label}>Catálogo</h2>
          <p style={{ margin: "10px 0 0", fontSize: 15 }}>
            {wines.length} etiquetas, todavía escritas a mano en{" "}
            <code>lib/data.ts</code>.
          </p>
          <p className={styles.hint} style={{ marginTop: 8 }}>
            La próxima etapa las pasa a la base y las hace editables desde acá,
            con importación desde la planilla.
          </p>
        </section>
      </div>
    </>
  );
}
