import Link from "next/link";
import { canManageCuentaCorriente, requireUser } from "@/lib/auth";
import { crearClienteAction } from "../actions";
import { ClienteForm } from "../cliente-forms";
import styles from "../../../admin.module.css";

export const metadata = { title: "Nuevo cliente" };

export default async function NuevoClientePage() {
  const actor = await requireUser();

  return (
    <>
      <Link href="/admin/clientes" className={styles.backLink}>
        ← Clientes
      </Link>

      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>Nuevo cliente</h1>
          <p className={styles.pageSub}>
            Alcanza con el nombre. Lo demás se completa cuando haga falta.
          </p>
        </div>
      </div>

      <section className={styles.card}>
        <ClienteForm
          action={crearClienteAction}
          submitLabel="Crear cliente"
          puedeVerPlata={canManageCuentaCorriente(actor)}
          conSaldoInicial
        />
      </section>
    </>
  );
}
