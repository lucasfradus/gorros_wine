import Image from "next/image";
import Link from "next/link";
import styles from "./hero.module.css";

export function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.shot}>
        <Image
          src="/hero-home.webp"
          alt="La cava de Gorros Wine"
          fill
          priority
          sizes="(max-width: 1180px) 100vw, 1180px"
          className={styles.img}
        />
      </div>

      <div className={styles.copy}>
        <p className={`eyebrow ${styles.eyebrow}`}>
          Vinoteca · Pilar, Buenos Aires
        </p>

        <h1 className={styles.title}>
          No solo vendemos vinos,
          <br />
          <em className={styles.titleAccent}>creamos experiencias.</em>
        </h1>

        <Link href="/catalogo" className={`btn btnOutline ${styles.cta}`}>
          Ver catálogo
        </Link>
      </div>
    </section>
  );
}
