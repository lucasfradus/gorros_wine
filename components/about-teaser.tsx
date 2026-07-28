import Link from "next/link";
import { PhotoSlot } from "./photo-slot";
import styles from "./about-teaser.module.css";

export function AboutTeaser() {
  return (
    <section className={styles.section} aria-labelledby="nosotros">
      <PhotoSlot
        label="Foto del local o del equipo"
        className={styles.shot}
      />

      <div className={styles.copy}>
        <p className={`eyebrow ${styles.eyebrow}`}>Acerca de nosotros</p>

        <h2 id="nosotros" className={styles.title}>
          Un lugar donde el vino
          <br />
          se vive y se comparte
        </h2>

        <p className={styles.body}>
          Gorros Wine nació de la pasión de Gonzalo y Agustina por el mundo del
          vino, y del deseo de crear un espacio donde cada cliente encuentre
          mucho más que una botella: encuentros, celebraciones y momentos
          inolvidables.
        </p>

        <Link href="/nosotros" className="linkUnder">
          Conocé nuestra historia
        </Link>
      </div>
    </section>
  );
}
