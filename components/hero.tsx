import Link from "next/link";
import { getContent } from "@/lib/content/get";
import { ContentImage } from "./content-image";
import { Lineas } from "./rich-text";
import styles from "./hero.module.css";

export async function Hero() {
  const c = await getContent("home");

  return (
    <section className={styles.hero}>
      <ContentImage
        imagen={c.heroImagen}
        etiqueta="Foto principal de la portada"
        className={styles.shot}
        priority
      />

      <div className={styles.copy}>
        <p className={`eyebrow ${styles.eyebrow}`}>{c.heroEyebrow}</p>

        <h1 className={styles.title}>
          <Lineas
            texto={c.heroTitulo}
            clases={{ acento: styles.titleAccent }}
          />
        </h1>

        <Link href="/catalogo" className={`btn btnOutline ${styles.cta}`}>
          {c.heroCta}
        </Link>
      </div>
    </section>
  );
}
