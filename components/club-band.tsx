import Link from "next/link";
import { getContent } from "@/lib/content/get";
import { Lineas } from "./rich-text";
import styles from "./club-band.module.css";

export async function ClubBand() {
  const c = await getContent("home");

  // id="club" es el destino del enlace "Club" del nav (/#club).
  return (
    <section id="club" className={styles.club} aria-labelledby="club-title">
      <p className={`eyebrow ${styles.eyebrow}`}>{c.clubEyebrow}</p>

      <h2 id="club-title" className={styles.title}>
        <Lineas texto={c.clubTitulo} />
      </h2>

      <p className={styles.lede}>{c.clubLede}</p>

      <Link href="/club" className="btn btnGold">
        {c.clubCta}
      </Link>
    </section>
  );
}
