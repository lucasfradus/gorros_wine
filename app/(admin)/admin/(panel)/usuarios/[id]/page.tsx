import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireUserManager, ROLES } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import {
  setPasswordAction,
  toggleActiveAction,
  updateUserAction,
} from "../actions";
import { PasswordForm, ToggleActiveForm, UserForm } from "../user-forms";
import styles from "../../../admin.module.css";

export const metadata = { title: "Editar usuario" };

export default async function EditarUsuarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await requireUserManager();

  // Sin este filtro, un id que no es UUID llega a Postgres y revienta la
  // consulta en vez de dar un 404 limpio.
  if (!z.uuid().safeParse(id).success) notFound();

  const [objetivo] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!objetivo) notFound();

  const esUnoMismo = objetivo.id === actor.id;
  const trabado =
    objetivo.lockedUntil && objetivo.lockedUntil.getTime() > Date.now();

  return (
    <>
      <Link href="/admin/usuarios" className={styles.backLink}>
        ← Usuarios
      </Link>

      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>{objetivo.name}</h1>
          <p className={styles.pageSub}>{objetivo.email}</p>
        </div>
      </div>

      <div className={styles.stack}>
        {trabado ? (
          <p className={`${styles.alert} ${styles.alertError}`}>
            La cuenta está trabada por intentos fallidos hasta las{" "}
            {formatDateTime(objetivo.lockedUntil)}. Cambiarle la contraseña la
            destraba.
          </p>
        ) : null}

        <section className={styles.card}>
          <h2 className={`${styles.label} ${styles.sectionHead}`}>
            Datos y rol
          </h2>
          <UserForm
            action={updateUserAction}
            roles={ROLES}
            defaults={{
              id: objetivo.id,
              name: objetivo.name,
              email: objetivo.email,
              role: objetivo.role,
            }}
            lockRole={esUnoMismo}
            submitLabel="Guardar cambios"
          />
        </section>

        <section className={styles.card}>
          <h2 className={`${styles.label} ${styles.sectionHead}`}>
            Contraseña
          </h2>
          <PasswordForm action={setPasswordAction} userId={objetivo.id} />
        </section>

        {esUnoMismo ? null : (
          <section className={styles.card}>
            <h2 className={`${styles.label} ${styles.sectionHead}`}>
              Acceso
            </h2>
            <ToggleActiveForm
              action={toggleActiveAction}
              userId={objetivo.id}
              isActive={objetivo.isActive}
            />
          </section>
        )}

        <section className={styles.card}>
          <h2 className={`${styles.label} ${styles.sectionHead}`}>
            Historial
          </h2>
          <ul className={styles.metaList}>
            <li>
              <span className={styles.metaLabel}>Creado</span>
              {formatDateTime(objetivo.createdAt)}
            </li>
            <li>
              <span className={styles.metaLabel}>Último ingreso</span>
              {formatDateTime(objetivo.lastLoginAt)}
            </li>
            <li>
              <span className={styles.metaLabel}>Intentos fallidos</span>
              {objetivo.failedAttempts}
            </li>
          </ul>
        </section>
      </div>
    </>
  );
}
