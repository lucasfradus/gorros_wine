import Link from "next/link";
import { getProximos } from "@/lib/eventos";
import { formatDia, formatHora, formatMes } from "@/lib/format";
import { getContent } from "@/lib/content/get";
import { ContentImage } from "./content-image";
import { Lineas } from "./rich-text";
import styles from "./home-events.module.css";

/** Cuántas fechas entran en el bloque de la home sin desbalancear la sección. */
const EN_LA_HOME = 2;

export async function HomeEvents() {
  const [c, proximos] = await Promise.all([
    getContent("home"),
    getProximos(EN_LA_HOME),
  ]);

  return (
    <section className={styles.section} aria-labelledby="eventos">
      <header className={styles.head}>
        <p className={`eyebrow ${styles.eyebrow}`}>{c.eventosEyebrow}</p>
        <h2 id="eventos" className={`sectionTitle ${styles.title}`}>
          <Lineas texto={c.eventosTitulo} />
        </h2>
        <p className={styles.lede}>{c.eventosLede}</p>
      </header>

      <div className={styles.gallery}>
        {c.eventosGaleria.map((e, i) => (
          <figure key={i} className={styles.shot}>
            <ContentImage
              imagen={e.imagen}
              etiqueta="Arrastrá una foto de un evento"
              height={360}
              sizes="(max-width: 900px) 100vw, 560px"
            />
            <figcaption className={styles.caption}>{e.epigrafe}</figcaption>
          </figure>
        ))}
      </div>

      {/* Sin fechas por venir no se dibuja nada: el aviso de "no hay eventos"
          vive en /eventos, y acá un bloque vacío ensuciaría la portada. La
          galería de arriba se sigue viendo igual. */}
      {proximos.length > 0 ? (
        <ul className={styles.upcoming}>
          {proximos.map((e) => (
            <li key={e.id} className={styles.event}>
              <p className={styles.date}>
                <span className={styles.day}>{formatDia(e.comienza)}</span>
                <span className={styles.month}>{formatMes(e.comienza)}</span>
              </p>
              <div className={styles.detail}>
                <h3 className={styles.name}>{e.titulo}</h3>
                <p className={styles.meta}>
                  {[formatHora(e.comienza), e.lugar, e.detalle]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <Link href="/eventos" className={styles.book}>
                Reservar
                <span className="srOnly"> {e.titulo}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
