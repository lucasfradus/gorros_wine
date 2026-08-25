import type { Metadata } from "next";
import { events } from "@/lib/data";
import { getContent } from "@/lib/content/get";
import { ContentImage } from "@/components/content-image";
import { Lineas } from "@/components/rich-text";
import styles from "./eventos.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const c = await getContent("eventos");
  return { title: c.seoTitulo, description: c.seoDescripcion };
}

export default async function EventsPage() {
  const [c, local] = await Promise.all([
    getContent("eventos"),
    getContent("local"),
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

      {/* Los eventos siguen escritos a mano: el ABM es otra iteración. */}
      <ul className={styles.list}>
        {events.map((e) => (
          <li key={e.title} className={styles.event}>
            <p className={styles.date}>
              <span className={styles.day}>{e.day}</span>
              <span className={styles.month}>{e.month}</span>
            </p>
            <div>
              <h2 className={styles.name}>{e.title}</h2>
              <p className={styles.meta}>{e.meta}</p>
            </div>
            <button type="button" className={styles.book}>
              Reservar · {e.price}
              <span className="srOnly"> {e.title}</span>
            </button>
          </li>
        ))}
      </ul>

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
