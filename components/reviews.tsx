import { getContent } from "@/lib/content/get";
import { Lineas } from "./rich-text";
import styles from "./reviews.module.css";

export async function Reviews() {
  const c = await getContent("home");

  return (
    <section className={styles.section} aria-labelledby="resenas">
      <p className={`eyebrow ${styles.eyebrow}`}>{c.resenasEyebrow}</p>
      <h2 id="resenas" className={`sectionTitle ${styles.title}`}>
        <Lineas texto={c.resenasTitulo} />
      </h2>

      <ul className={styles.grid}>
        {c.resenas.map((r, i) => (
          <li key={i} className={styles.card}>
            <p className={styles.stars} aria-label="5 de 5 estrellas">
              <span aria-hidden="true">★★★★★</span>
            </p>
            <blockquote className={styles.quote}>“{r.quote}”</blockquote>
            <p className={styles.author}>
              {r.name} · {r.tag}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
