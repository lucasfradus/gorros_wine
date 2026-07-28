import { steps } from "@/lib/data";
import styles from "./how-to-buy.module.css";

export function HowToBuy() {
  return (
    <section className={styles.section} aria-labelledby="como-comprar">
      <h2 id="como-comprar" className={styles.title}>
        Comprar es fácil
      </h2>

      <ol className={styles.grid}>
        {steps.map((s) => (
          <li key={s.n} className={styles.step}>
            <p className={styles.num} aria-hidden="true">
              {s.n}
            </p>
            <h3 className={styles.stepTitle}>{s.title}</h3>
            <p className={styles.body}>{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
