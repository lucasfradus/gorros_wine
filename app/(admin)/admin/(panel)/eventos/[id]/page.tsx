import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { eventos } from "@/lib/db/schema";
import { requireEventEditor } from "@/lib/auth";
import { aInputLocal, formatDateTime } from "@/lib/format";
import { deleteEventoAction, updateEventoAction } from "../actions";
import { BorrarEvento, EventoForm } from "../evento-forms";
import styles from "../../../admin.module.css";

export const metadata = { title: "Editar evento" };

export default async function EditarEventoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireEventEditor();

  // Sin este filtro, un id que no es UUID llega a Postgres y revienta la
  // consulta en vez de dar un 404 limpio.
  if (!z.uuid().safeParse(id).success) notFound();

  const [evento] = await db
    .select()
    .from(eventos)
    .where(eq(eventos.id, id))
    .limit(1);

  if (!evento) notFound();

  const yaPaso = evento.comienza.getTime() < Date.now();

  return (
    <>
      <Link href="/admin/eventos" className={styles.backLink}>
        ← Eventos
      </Link>

      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>{evento.titulo}</h1>
          <p className={styles.pageSub}>
            Última edición: {formatDateTime(evento.updatedAt)}
          </p>
        </div>
      </div>

      <div className={styles.stack}>
        {yaPaso ? (
          <p className={`${styles.alert} ${styles.alertOk}`}>
            Este evento ya pasó. Si está publicado se sigue viendo en el sitio,
            abajo de los próximos y sin botón de reserva.
          </p>
        ) : null}

        <section className={styles.card}>
          <EventoForm
            action={updateEventoAction}
            submitLabel="Guardar cambios"
            defaults={{
              id: evento.id,
              titulo: evento.titulo,
              comienza: aInputLocal(evento.comienza),
              lugar: evento.lugar,
              detalle: evento.detalle ?? "",
              precio: String(Math.round(evento.precioCentavos / 100)),
              imagen: evento.imagen,
              publicado: evento.publicado,
            }}
          />
        </section>

        <section className={styles.card}>
          <div className={styles.sectionHead}>
            <h2 className={styles.pageTitle}>Borrar</h2>
          </div>
          <BorrarEvento
            action={deleteEventoAction}
            eventoId={evento.id}
            titulo={evento.titulo}
          />
        </section>
      </div>
    </>
  );
}
