import Link from "next/link";
import styles from "./club-band.module.css";

export function ClubBand() {
  // id="club" es el destino del enlace "Club" del nav (/#club).
  return (
    <section id="club" className={styles.club} aria-labelledby="club-title">
      <p className={`eyebrow ${styles.eyebrow}`}>Club Gorros</p>

      <h2 id="club-title" className={styles.title}>
        Tres etiquetas elegidas para vos, cada mes.
      </h2>

      <p className={styles.lede}>
        Curaduría mensual con notas de cata y maridajes, precios de socio y
        acceso prioritario a las catas.
      </p>

      <Link href="/club" className="btn btnGold">
        Sumarme al club
      </Link>
    </section>
  );
}
