import Link from "next/link";
import styles from "./club-band.module.css";

export function ClubBand() {
  return (
    <section className={styles.club} aria-labelledby="club">
      <p className={`eyebrow ${styles.eyebrow}`}>Club Gorros</p>

      <h2 id="club" className={styles.title}>
        Una membresía para quienes viven el vino.
      </h2>

      <p className={styles.lede}>
        Tres etiquetas seleccionadas cada mes, acceso prioritario a catas y
        precios de socio.
      </p>

      <Link href="/club" className={`btn btnGold ${styles.cta}`}>
        Conocer el club
      </Link>
    </section>
  );
}
