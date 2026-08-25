import { getContent } from "@/lib/content/get";
import { Lineas } from "./rich-text";
import styles from "./how-to-buy.module.css";

export async function HowToBuy() {
  const c = await getContent("home");

  return (
    <section className={styles.section} aria-labelledby="como-comprar">
      <h2 id="como-comprar" className={styles.title}>
        <Lineas texto={c.comoTitulo} />
      </h2>

      <ol className={styles.grid}>
        {c.pasos.map((s, i) => (
          <li key={i} className={styles.step}>
            {/* El número sale del orden: si alguien agrega un paso en el medio,
                la numeración se acomoda sola y nadie la puede desalinear. */}
            <p className={styles.num} aria-hidden="true">
              {String(i + 1).padStart(2, "0")}
            </p>
            <h3 className={styles.stepTitle}>{s.title}</h3>
            <p className={styles.body}>{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
