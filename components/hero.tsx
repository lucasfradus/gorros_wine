import Link from "next/link";
import styles from "./hero.module.css";

export function Hero() {
  return (
    <section className={styles.hero}>
      <p className={`eyebrow ${styles.eyebrow}`}>Vinoteca boutique · Pilar</p>

      <h1 className={styles.title}>
        La cava, ahora
        <br />
        <em className={styles.titleAccent}>a un clic de distancia.</em>
      </h1>

      <p className={styles.lede}>
        Selección curada de tintos, blancos y espumantes. Comprá online con
        retiro en el local o envío a domicilio.
      </p>

      <div className={styles.actions}>
        <Link href="/catalogo" className="btn btnGold">
          Ver catálogo
        </Link>
        <Link href="/club" className="btn btnOutline">
          Sumarme al club
        </Link>
      </div>

      {/* Hueco de foto: el fondo va reemplazado por una foto oscura de la cava. */}
      <span className={`photoNote ${styles.photoNote}`} aria-hidden="true">
        [ fondo · foto de la cava, oscura ]
      </span>
    </section>
  );
}
