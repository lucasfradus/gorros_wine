import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { crearBodegaAction } from "../actions";
import { BodegaForm } from "../bodega-forms";
import styles from "../../../admin.module.css";

export const metadata = { title: "Nueva bodega" };

export default async function NuevaBodegaPage() {
  await requireUser();

  return (
    <>
      <Link href="/admin/bodegas" className={styles.backLink}>
        ← Bodegas
      </Link>

      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>Nueva bodega</h1>
          <p className={styles.pageSub}>
            Con el nombre alcanza para empezar. El contacto y las condiciones
            se pueden completar después.
          </p>
        </div>
      </div>

      <section className={styles.card}>
        <BodegaForm action={crearBodegaAction} submitLabel="Crear bodega" />
      </section>
    </>
  );
}
