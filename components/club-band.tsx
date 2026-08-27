import Image from "next/image";
import Link from "next/link";
import { getContent } from "@/lib/content/get";
import { Lineas } from "./rich-text";
import styles from "./club-band.module.css";

export async function ClubBand() {
  const c = await getContent("home");
  const fondo = c.clubFondo;

  // id="club" es el destino del enlace "Club" del nav (/#club).
  return (
    <section
      id="club"
      className={fondo ? `${styles.club} ${styles.conFoto}` : styles.club}
      aria-labelledby="club-title"
    >
      {fondo && (
        <>
          <Image
            src={fondo.src}
            alt={fondo.alt}
            fill
            sizes="(max-width: 1180px) 100vw, 1180px"
            className={styles.foto}
          />
          {/* El velo va en su propio elemento y no como gradiente sobre la
              foto: así el contraste del texto no depende de qué imagen suban
              desde el panel. Lo de arriba queda en `.inner`, que al estar
              posicionado se pinta después de los dos. */}
          <div className={styles.velo} aria-hidden="true" />
        </>
      )}

      <div className={styles.inner}>
        <p className={`eyebrow ${styles.eyebrow}`}>{c.clubEyebrow}</p>

        <h2 id="club-title" className={styles.title}>
          <Lineas texto={c.clubTitulo} />
        </h2>

        <p className={styles.lede}>{c.clubLede}</p>

        <Link href="/club" className="btn btnGold">
          {c.clubCta}
        </Link>
      </div>
    </section>
  );
}
