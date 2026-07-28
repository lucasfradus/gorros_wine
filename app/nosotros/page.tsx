import type { Metadata } from "next";
import Link from "next/link";
import { values } from "@/lib/data";
import { PhotoSlot } from "@/components/photo-slot";
import styles from "./nosotros.module.css";

export const metadata: Metadata = {
  title: "Nosotros",
  description:
    "Gorros Wine nació de la pasión de Gonzalo y Agustina por el mundo del vino. Vinoteca en Pilar, Buenos Aires.",
};

export default function AboutPage() {
  return (
    <>
      <section className={styles.intro}>
        <div className={styles.copy}>
          <p className={`eyebrow ${styles.eyebrow}`}>Nosotros</p>

          <h1 className={styles.title}>
            El vino se vive,
            <br />
            se comparte
            <br />y se <em className={styles.accent}>disfruta.</em>
          </h1>

          <p className={styles.para}>
            Gorros Wine nació de la pasión de{" "}
            <b className={styles.strong}>Gonzalo y Agustina</b> por el mundo del
            vino, y del deseo de crear un espacio donde cada cliente encuentre
            mucho más que una botella.
          </p>

          <p className={styles.para}>
            Con una cuidada selección de etiquetas de las principales bodegas
            argentinas e internacionales, buscamos acercar vinos que inspiren
            encuentros, celebraciones y momentos inolvidables.
          </p>

          <p className={styles.para}>
            Creemos en el asesoramiento personalizado, en descubrir las
            historias detrás de cada etiqueta y en compartir la cultura del vino
            a través de degustaciones, experiencias exclusivas y nuestra feria{" "}
            <b className={styles.strongGold}>Caminos del Vino</b>.
          </p>
        </div>

        <PhotoSlot
          label="Foto del local / Gonzalo y Agustina"
          className={styles.shot}
        />
      </section>

      <ul className={styles.values}>
        {values.map((v) => (
          <li key={v.title} className={styles.value}>
            <h2 className={styles.valueTitle}>{v.title}</h2>
            <p className={styles.valueBody}>{v.body}</p>
          </li>
        ))}
      </ul>

      <section className={styles.closing}>
        <p className={`eyebrow ${styles.closingEyebrow}`}>
          Bienvenidos a Gorros Wine
        </p>
        <p className={styles.closingTitle}>
          No solo vendemos vinos,{" "}
          <em className={styles.accent}>creamos experiencias.</em>
        </p>
        <p className={styles.closingSub}>Viví tu experiencia Gorros Wine</p>
        <Link href="/catalogo" className="btn btnGold">
          Explorar el catálogo
        </Link>
      </section>
    </>
  );
}
