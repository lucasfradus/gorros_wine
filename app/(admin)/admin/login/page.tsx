import { redirect } from "next/navigation";
import { getCurrentUser, safeNext } from "@/lib/auth";
import { getTheme } from "@/lib/theme-server";
import { Isotipo } from "@/components/isotipo";
import { LoginForm } from "./login-form";
import styles from "../admin.module.css";

export const metadata = { title: "Ingresar" };

/**
 * El middleware deja pasar esta ruta sin mirar nada. Acá sí se valida contra
 * la base: si la sesión es buena, se entra derecho al panel; si la cookie
 * está vencida, se muestra el formulario en vez de rebotar en un bucle.
 *
 * La pantalla respeta el modo elegido dentro del panel, aunque el selector no
 * esté acá: la preferencia vive en una cookie y se lee igual sin sesión.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const [user, theme] = await Promise.all([getCurrentUser(), getTheme()]);

  if (user) redirect(safeNext(next));

  return (
    <div className={`${styles.themed} ${styles.loginWrap}`} data-theme={theme}>
      <div className={styles.loginCard}>
        <div className={styles.loginBrand}>
          <Isotipo size={40} className={styles.loginMark} />
          <span className={styles.loginLogo}>Gorros Wine</span>
          <span className={styles.loginKicker}>Administración</span>
        </div>
        <LoginForm next={next} />
      </div>
    </div>
  );
}
