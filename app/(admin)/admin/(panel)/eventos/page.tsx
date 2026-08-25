import Link from "next/link";
import { asc, desc, gte, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { eventos, type Evento } from "@/lib/db/schema";
import { requireEventEditor } from "@/lib/auth";
import { formatDia, formatHora, formatMes } from "@/lib/format";
import { formatPrice } from "@/lib/data";
import styles from "../../admin.module.css";
import propios from "./eventos.module.css";

export const metadata = { title: "Eventos" };

/**
 * La agenda, partida en dos por la misma línea que usa la tienda: `comienza`
 * contra el momento de abrir la pantalla.
 *
 * Acá se listan todos los pasados y no los últimos seis como en el sitio: en
 * el panel el histórico completo es justamente lo que se viene a buscar.
 */
export default async function EventosPage() {
  await requireEventEditor();
  const ahora = new Date();

  const [proximos, pasados] = await Promise.all([
    db
      .select()
      .from(eventos)
      .where(gte(eventos.comienza, ahora))
      .orderBy(asc(eventos.comienza)),
    db
      .select()
      .from(eventos)
      .where(lt(eventos.comienza, ahora))
      .orderBy(desc(eventos.comienza)),
  ]);

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>Eventos</h1>
          <p className={styles.pageSub}>
            Las catas y encuentros que se ven en el sitio. Los textos y las
            fotos que los rodean se editan en Contenido.
          </p>
        </div>
        <Link
          href="/admin/eventos/nuevo"
          className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`}
        >
          Nuevo evento
        </Link>
      </div>

      <div className={styles.stack}>
        <Tabla
          titulo="Próximos"
          filas={proximos}
          vacio="No hay ningún evento por venir. El sitio muestra el aviso de que no hay fechas publicadas."
        />

        {pasados.length > 0 ? (
          <Tabla titulo="Ya pasaron" filas={pasados} pasado />
        ) : null}
      </div>
    </>
  );
}

function Tabla({
  titulo,
  filas,
  vacio,
  pasado = false,
}: {
  titulo: string;
  filas: Evento[];
  vacio?: string;
  pasado?: boolean;
}) {
  return (
    <section className={`${styles.card} ${styles.cardTight}`}>
      <div className={styles.sectionHead}>
        <h2 className={styles.pageTitle}>{titulo}</h2>
      </div>

      {filas.length === 0 ? (
        <p className={styles.empty}>{vacio}</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Cuándo</th>
                <th scope="col">Evento</th>
                <th scope="col">Precio</th>
                <th scope="col">Estado</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {filas.map((e) => (
                <tr key={e.id} className={pasado ? propios.pasado : undefined}>
                  <td className={propios.cuando}>
                    <span className={styles.cellName}>
                      {formatDia(e.comienza)} {formatMes(e.comienza)}
                    </span>
                    <span className={styles.cellMail}>
                      {formatHora(e.comienza)}
                    </span>
                  </td>
                  <td>
                    <span className={styles.cellName}>{e.titulo}</span>
                    <span className={styles.cellMail}>
                      {e.lugar}
                      {e.detalle ? ` · ${e.detalle}` : ""}
                    </span>
                  </td>
                  <td className={styles.cellDim}>
                    {formatPrice(Math.round(e.precioCentavos / 100))}
                  </td>
                  <td>
                    <span
                      className={`${styles.badge} ${
                        e.publicado ? styles.badgeOn : styles.badgeOff
                      }`}
                    >
                      {e.publicado ? "Publicado" : "Borrador"}
                    </span>
                  </td>
                  <td className={styles.cellRight}>
                    <Link
                      href={`/admin/eventos/${e.id}`}
                      className={`${styles.btn} ${styles.btnSmall}`}
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
