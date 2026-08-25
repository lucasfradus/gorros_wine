import Link from "next/link";
import { getContent } from "@/lib/content/get";
import { ContentImage } from "./content-image";
import { Lineas } from "./rich-text";
import styles from "./about-teaser.module.css";

export async function AboutTeaser() {
  const c = await getContent("home");

  return (
    <section className={styles.section} aria-labelledby="nosotros">
      <ContentImage
        imagen={c.nosotrosImagen}
        etiqueta="Foto del local o del equipo"
        className={styles.shot}
        sizes="(max-width: 900px) 100vw, 560px"
      />

      <div className={styles.copy}>
        <p className={`eyebrow ${styles.eyebrow}`}>{c.nosotrosEyebrow}</p>

        <h2 id="nosotros" className={styles.title}>
          <Lineas texto={c.nosotrosTitulo} />
        </h2>

        <p className={styles.body}>{c.nosotrosBody}</p>

        <Link href="/nosotros" className="linkUnder">
          {c.nosotrosLink}
        </Link>
      </div>
    </section>
  );
}
