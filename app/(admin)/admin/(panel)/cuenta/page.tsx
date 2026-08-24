import { requireUser, ROLE_DESCRIPTION, ROLE_LABEL } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { ChangePasswordForm } from "./password-form";
import styles from "../../admin.module.css";

export const metadata = { title: "Mi cuenta" };

export default async function CuentaPage() {
  const user = await requireUser();

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>Mi cuenta</h1>
          <p className={styles.pageSub}>Tus datos de acceso al panel.</p>
        </div>
      </div>

      <div className={styles.stack}>
        <section className={styles.card}>
          <ul className={styles.metaList}>
            <li>
              <span className={styles.metaLabel}>Nombre</span>
              {user.name}
            </li>
            <li>
              <span className={styles.metaLabel}>Mail</span>
              {user.email}
            </li>
            <li>
              <span className={styles.metaLabel}>Rol</span>
              {ROLE_LABEL[user.role]}
              <span className={styles.hint} style={{ marginTop: 3 }}>
                {ROLE_DESCRIPTION[user.role]}
              </span>
            </li>
            <li>
              <span className={styles.metaLabel}>Último ingreso</span>
              {formatDateTime(user.lastLoginAt)}
            </li>
          </ul>
          <p className={styles.hint} style={{ marginTop: 18 }}>
            El nombre, el mail y el rol los cambia un administrador desde la
            sección Usuarios.
          </p>
        </section>

        <section className={styles.card}>
          <h2 className={`${styles.label} ${styles.sectionHead}`}>
            Cambiar contraseña
          </h2>
          <ChangePasswordForm />
        </section>
      </div>
    </>
  );
}
