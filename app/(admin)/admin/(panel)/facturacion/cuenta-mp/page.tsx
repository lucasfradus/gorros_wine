import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { cuentasMp } from "@/lib/db/schema";
import { requireFacturacion } from "@/lib/auth";
import { mpConfigurado } from "@/lib/mercadopago/cuenta";
import { formatDate } from "@/lib/format";
import { desactivarCuentaAction } from "../actions";
import styles from "../../../admin.module.css";
import propios from "../facturacion.module.css";

export const metadata = { title: "Cuenta de Mercado Pago" };

const AVISOS: Record<string, { tipo: "ok" | "error"; texto: string }> = {
  vinculada: { tipo: "ok", texto: "Cuenta vinculada. Ya se pueden traer los cobros." },
  state: {
    tipo: "error",
    texto:
      "La vuelta desde Mercado Pago no coincidió con el pedido (o pasaron más de 10 minutos). Volvé a intentar.",
  },
  oauth: {
    tipo: "error",
    texto:
      "Mercado Pago no aceptó la vinculación. Revisá que la redirect URI de la app coincida con la de este sitio.",
  },
  config: {
    tipo: "error",
    texto: "Faltan las variables de Mercado Pago en el entorno (MP_APP_ID y compañía).",
  },
};

const DIA = 24 * 60 * 60 * 1000;

export default async function CuentaMpPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireFacturacion();
  const { ok, error } = await searchParams;
  const aviso = AVISOS[ok ?? error ?? ""];

  const cuentas = await db.select().from(cuentasMp).orderBy(desc(cuentasMp.isActive));
  const activa = cuentas.find((c) => c.isActive);
  const diasRestantes = activa
    ? Math.floor((activa.expiresAt.getTime() - Date.now()) / DIA)
    : null;

  return (
    <>
      <Link href="/admin/facturacion" className={styles.backLink}>
        ← Facturación
      </Link>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>Cuenta de Mercado Pago</h1>
          <p className={styles.pageSub}>
            De dónde salen los cobros que se facturan. Se vincula una vez y se
            renueva sola cada día.
          </p>
        </div>
      </div>

      {aviso ? (
        <p
          className={`${styles.alert} ${aviso.tipo === "ok" ? styles.alertOk : styles.alertError}`}
          role={aviso.tipo === "ok" ? "status" : "alert"}
        >
          {aviso.texto}
        </p>
      ) : null}

      <section className={styles.card}>
        {activa ? (
          <>
            <dl className={propios.cuentaDatos}>
              <dt>Cuenta</dt>
              <dd>{activa.alias}</dd>
              <dt>Usuario de MP</dt>
              <dd>{activa.mpUserId}</dd>
              <dt>Vinculada</dt>
              <dd>{formatDate(activa.createdAt)}</dd>
              <dt>El permiso vence</dt>
              <dd>
                {formatDate(activa.expiresAt)}
                {diasRestantes !== null && diasRestantes < 7 ? (
                  <span className={propios.error}>
                    {" "}
                    — {diasRestantes < 0 ? "vencido" : `en ${diasRestantes} días`}:
                    volvé a vincular
                  </span>
                ) : null}
              </dd>
            </dl>
            <div className={styles.btnRow}>
              <a href="/api/mercadopago" className={`${styles.btn} ${styles.btnSmall}`}>
                Volver a vincular
              </a>
              <form action={desactivarCuentaAction}>
                <input type="hidden" name="id" value={activa.id} />
                <button
                  type="submit"
                  className={`${styles.btn} ${styles.btnSmall} ${styles.btnDanger}`}
                >
                  Desvincular
                </button>
              </form>
            </div>
          </>
        ) : (
          <>
            <p className={styles.hint}>
              {mpConfigurado()
                ? "No hay ninguna cuenta vinculada. Al tocar el botón, Mercado Pago pide entrar con la cuenta del local y autorizar a Gorros a leer sus cobros."
                : "Faltan las variables de Mercado Pago en el entorno: MP_APP_ID, MP_CLIENT_SECRET, MP_REDIRECT_URI y MP_TOKEN_ENCRYPTION_KEY."}
            </p>
            {mpConfigurado() ? (
              // <a> y no <Link>: es un route handler que redirige afuera.
              <a href="/api/mercadopago" className={`${styles.btn} ${styles.btnPrimary}`}>
                Vincular Mercado Pago
              </a>
            ) : null}
          </>
        )}
      </section>
    </>
  );
}
