import { redirect } from "next/navigation";
import { getCurrentUser, safeNext } from "@/lib/auth";
import { LoginForm } from "./login-form";
import styles from "../admin.module.css";

export const metadata = { title: "Ingresar" };

/**
 * El middleware deja pasar esta ruta sin mirar nada. Acá sí se valida contra
 * la base: si la sesión es buena, se entra derecho al panel; si la cookie
 * está vencida, se muestra el formulario en vez de rebotar en un bucle.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const user = await getCurrentUser();

  if (user) redirect(safeNext(next));

  return (
    <div className={styles.loginWrap}>
      <div className={styles.loginCard}>
        <div className={styles.loginBrand}>
          <span className={styles.loginLogo}>Gorros Wine</span>
          <span className={styles.loginKicker}>Administración</span>
        </div>
        <LoginForm next={next} />
      </div>
    </div>
  );
}
