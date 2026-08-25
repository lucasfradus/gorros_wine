import Link from "next/link";
import { upcomingEvents } from "@/lib/data";
import { getContent } from "@/lib/content/get";
import { ContentImage } from "./content-image";
import { Lineas } from "./rich-text";
import styles from "./home-events.module.css";

export async function HomeEvents() {
  const c = await getContent("home");

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

      {/* Los eventos siguen escritos a mano: el ABM es otra iteración. */}
      <ul className={styles.upcoming}>
        {upcomingEvents.map((e) => (
          <li key={e.title} className={styles.event}>
            <p className={styles.date}>
              <span className={styles.day}>{e.day}</span>
              <span className={styles.month}>{e.month}</span>
            </p>
            <div className={styles.detail}>
              <h3 className={styles.name}>{e.title}</h3>
              <p className={styles.meta}>{e.meta}</p>
            </div>
            <Link href="/eventos" className={styles.book}>
              Reservar
              <span className="srOnly"> {e.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
