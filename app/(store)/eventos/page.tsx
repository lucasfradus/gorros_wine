import type { Metadata } from "next";
import type { EventoPublico } from "@/lib/eventos";
import { formatPrice } from "@/lib/data";
import { getAgenda } from "@/lib/eventos";
import { formatDia, formatHora, formatMes } from "@/lib/format";
import { getContent } from "@/lib/content/get";
import { ContentImage } from "@/components/content-image";
import { Lineas } from "@/components/rich-text";
import styles from "./eventos.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const c = await getContent("eventos");
  return { title: c.seoTitulo, description: c.seoDescripcion };
}

export default async function EventsPage() {
  const [c, local, agenda] = await Promise.all([
    getContent("eventos"),
    getContent("local"),
    getAgenda(),
  ]);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={`eyebrow ${styles.eyebrow}`}>{c.eyebrow}</p>
        <h1 className={styles.title}>
          <Lineas texto={c.titulo} />
        </h1>
        <p className={styles.lede}>{c.lede}</p>
      </header>

      <div className={styles.gallery}>
        {c.galeria.map((g, i) => (
          <ContentImage
            key={i}
            imagen={g.imagen}
            etiqueta="Foto de un evento pasado"
            height={300}
            sizes="(max-width: 900px) 100vw, 560px"
          />
        ))}
      </div>

      {agenda.proximos.length === 0 ? (
        <p className={styles.vacio}>{c.sinEventos}</p>
      ) : (
        <ul className={styles.list}>
          {agenda.proximos.map((e) => (
            <Fila key={e.id} evento={e} />
          ))}
        </ul>
      )}

      {agenda.pasados.length > 0 ? (
        <section className={styles.past} aria-labelledby="pasados">
          <h2 id="pasados" className={styles.pastTitle}>
            {c.pasadosTitulo}
          </h2>
          <ul className={styles.list}>
            {agenda.pasados.map((e) => (
              <Fila key={e.id} evento={e} pasado />
            ))}
          </ul>
        </section>
      ) : null}

      <section className={styles.fair} aria-labelledby="caminos">
        <p className={`eyebrow ${styles.fairEyebrow}`}>{c.feriaEyebrow}</p>
        <h2 id="caminos" className={styles.fairTitle}>
          <Lineas texto={c.feriaTitulo} />
        </h2>
        <p className={styles.fairBody}>{c.feriaBody}</p>
        <button type="button" className="btn btnOutline">
          {c.feriaCta}
        </button>
      </section>

      <section className={styles.private}>
        <div>
          <h2 className={styles.privateTitle}>
            <Lineas texto={c.privadaTitulo} />
          </h2>
          <p className={styles.privateBody}>{c.privadaBody}</p>
        </div>
        <a href={`mailto:${local.email}`} className="btn btnGold">
          {c.privadaCta}
        </a>
      </section>
    </div>
  );
}

/**
 * Un renglón de la agenda.
 *
 * El que ya pasó se muestra apagado y sin botón: sigue ahí porque un encuentro
 * hecho vale como prueba de que esto pasa de verdad, pero no se puede reservar.
 */
function Fila({ evento, pasado = false }: { evento: EventoPublico; pasado?: boolean }) {
  const meta = [
    formatHora(evento.comienza),
    evento.lugar,
    evento.detalle,
  ].filter(Boolean);

  // Los próximos cuelgan del h1 de la página; los pasados, del h2 de su
  // sección. Saltear un nivel deja la navegación por encabezados mal armada
  // para quien recorre la página con un lector de pantalla.
  const Titulo = pasado ? "h3" : "h2";

  return (
    <li className={`${styles.event} ${pasado ? styles.eventPast : ""}`}>
      <ContentImage
        imagen={evento.imagen}
        etiqueta="Foto del evento"
        className={styles.shot}
        height={96}
        sizes="120px"
      />

      <p className={styles.date}>
        <span className={styles.day}>{formatDia(evento.comienza)}</span>
        <span className={styles.month}>{formatMes(evento.comienza)}</span>
      </p>

      <div>
        <Titulo className={styles.name}>{evento.titulo}</Titulo>
        <p className={styles.meta}>{meta.join(" · ")}</p>
      </div>

      {pasado ? null : (
        <button type="button" className={styles.book}>
          Reservar · {formatPrice(Math.round(evento.precioCentavos / 100))}
          <span className="srOnly"> {evento.titulo}</span>
        </button>
      )}
    </li>
  );
}
