import Link from "next/link";
import { assignableRoles, requireUserManager } from "@/lib/auth";
import { createUserAction } from "../actions";
import { UserForm } from "../user-forms";
import styles from "../../../admin.module.css";

export const metadata = { title: "Nuevo usuario" };

export default async function NuevoUsuarioPage() {
  const actor = await requireUserManager();

  return (
    <>
      <Link href="/admin/usuarios" className={styles.backLink}>
        ← Usuarios
      </Link>

      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>Nuevo usuario</h1>
          <p className={styles.pageSub}>
            Le das una contraseña inicial y se la pasás por un canal seguro. La
            persona la cambia desde Mi cuenta al entrar.
          </p>
        </div>
      </div>

      <section className={styles.card}>
        <UserForm
          action={createUserAction}
          roles={assignableRoles(actor)}
          withPassword
          submitLabel="Crear usuario"
        />
      </section>
    </>
  );
}
