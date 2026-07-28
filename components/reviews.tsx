import { reviews } from "@/lib/data";
import styles from "./reviews.module.css";

export function Reviews() {
  return (
    <section className={styles.section} aria-labelledby="resenas">
      <p className={`eyebrow ${styles.eyebrow}`}>Lo que dicen</p>
      <h2 id="resenas" className={`sectionTitle ${styles.title}`}>
        Clientes de Gorros
      </h2>

      <ul className={styles.grid}>
        {reviews.map((r) => (
          <li key={r.name} className={styles.card}>
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
