import type { Metadata } from "next";
import { getContent } from "@/lib/content/get";
import { Lineas } from "@/components/rich-text";
import styles from "./club.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const c = await getContent("club");
  return { title: c.seoTitulo, description: c.seoDescripcion };
}

export default async function ClubPage() {
  const [c, local] = await Promise.all([
    getContent("club"),
    getContent("local"),
  ]);

  const waHref = `https://wa.me/${local.whatsapp}?text=${encodeURIComponent(
    c.waMensaje,
  )}`;

  return (
    <>
      <section className={styles.head}>
        <p className={`eyebrow ${styles.eyebrow}`}>{c.eyebrow}</p>
        <h1 className={styles.title}>
          <Lineas texto={c.titulo} clases={{ acento: styles.accent }} />
        </h1>
        <p className={styles.lede}>{c.lede}</p>
        <a
          href={waHref}
          className="btn btnGold"
          target="_blank"
          rel="noopener noreferrer"
        >
          {c.cta}
        </a>
      </section>

      <ul className={styles.includes}>
        {c.incluye.map((i, n) => (
          <li key={n} className={styles.include}>
            <h2 className={styles.includeTitle}>{i.title}</h2>
            <p className={styles.includeBody}>{i.body}</p>
          </li>
        ))}
      </ul>

      <section className={styles.how} aria-labelledby="como-funciona">
        <h2 id="como-funciona" className={styles.howTitle}>
          <Lineas texto={c.comoTitulo} />
        </h2>
        <ol className={styles.steps}>
          {c.pasos.map((s, i) => (
            <li key={i} className={styles.step}>
              {/* El número sale del orden, no de un campo que se pueda
                  desalinear al agregar un paso en el medio. */}
              <p className={styles.num} aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </p>
              <h3 className={styles.stepTitle}>{s.title}</h3>
              <p className={styles.stepBody}>{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.closing}>
        <p className={styles.closingTitle}>
          <Lineas texto={c.cierreTitulo} />
        </p>
        <a
          href={waHref}
          className="btn btnOutline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {c.cierreCta}
        </a>
      </section>
    </>
  );
}
