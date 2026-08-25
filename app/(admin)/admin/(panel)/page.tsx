import Link from "next/link";
import { count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bodegas, productos, users } from "@/lib/db/schema";
import { canManageUsers, requireUser } from "@/lib/auth";
import { getEditados } from "@/lib/content/get";
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

  const porGrupo = await getEditados();
  const editados = Object.values(porGrupo).reduce((n, c) => n + c.length, 0);

  const [[productosActivos], [bodegasActivas]] = await Promise.all([
    db
      .select({ n: count() })
      .from(productos)
      .where(eq(productos.isActive, true)),
    db.select({ n: count() }).from(bodegas).where(eq(bodegas.isActive, true)),
  ]);

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

        <section className={styles.card}>
          <h2 className={styles.label}>Contenido del sitio</h2>
          <p style={{ margin: "10px 0 0", fontSize: 15 }}>
            {editados === 0
              ? "Todo como vino con el diseño."
              : editados === 1
                ? "1 campo editado."
                : `${editados} campos editados.`}
          </p>
          <p className={styles.hint} style={{ marginTop: 8 }}>
            Los textos y las fotos de la home, Nosotros, Club, Eventos y el pie
            de página.
          </p>
          <div className={styles.btnRow} style={{ marginTop: 16 }}>
            <Link
              href="/admin/contenido"
              className={`${styles.btn} ${styles.btnSmall}`}
            >
              Editar contenido
            </Link>
          </div>
        </section>

        {/* Se cuenta lo que hay en la base, y se aclara que la tienda todavía
            no lo lee: decir "N etiquetas" a secas haría creer que el sitio ya
            muestra eso. */}
        <section className={styles.card}>
          <h2 className={styles.label}>Catálogo</h2>
          <p style={{ margin: "10px 0 0", fontSize: 15 }}>
            {productosActivos.n === 0
              ? "Todavía no hay productos cargados."
              : `${productosActivos.n} ${
                  productosActivos.n === 1 ? "producto activo" : "productos activos"
                } de ${bodegasActivas.n} ${
                  bodegasActivas.n === 1 ? "bodega" : "bodegas"
                }.`}
          </p>
          <p className={styles.hint} style={{ marginTop: 8 }}>
            La tienda pública sigue mostrando las {wines.length} etiquetas
            escritas a mano en <code>lib/data.ts</code>. Cablearla a la base es
            la etapa que viene.
          </p>
          <div className={styles.btnRow} style={{ marginTop: 16 }}>
            <Link
              href="/admin/productos"
              className={`${styles.btn} ${styles.btnSmall}`}
            >
              Ver productos
            </Link>
            <Link
              href="/admin/bodegas"
              className={`${styles.btn} ${styles.btnSmall}`}
            >
              Bodegas
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
