import Link from "next/link";
import { requireEventEditor } from "@/lib/auth";
import { createEventoAction } from "../actions";
import { EventoForm } from "../evento-forms";
import styles from "../../../admin.module.css";

export const metadata = { title: "Nuevo evento" };

export default async function NuevoEventoPage() {
  await requireEventEditor();

  return (
    <>
      <Link href="/admin/eventos" className={styles.backLink}>
        ← Eventos
      </Link>

      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>Nuevo evento</h1>
          <p className={styles.pageSub}>
            Arranca como borrador. Tildá <strong>Publicado</strong> cuando esté
            listo para que se vea en el sitio.
          </p>
        </div>
      </div>

      <section className={styles.card}>
        <EventoForm action={createEventoAction} submitLabel="Crear evento" />
      </section>
    </>
  );
}
