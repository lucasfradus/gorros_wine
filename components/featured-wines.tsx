import Link from "next/link";
import { featuredWines } from "@/lib/data";
import { WineCard } from "./wine-card";
import styles from "./featured-wines.module.css";

export function FeaturedWines() {
  return (
    <section className={styles.section} aria-labelledby="destacados">
      <p className={`eyebrow ${styles.eyebrow}`}>Selección</p>
      <h2 id="destacados" className={`sectionTitle ${styles.title}`}>
        Etiquetas destacadas
      </h2>

      <div className={styles.grid}>
        {featuredWines.map((wine) => (
          <WineCard key={wine.id} wine={wine} />
        ))}
      </div>

      <Link href="/catalogo" className={`linkUnder ${styles.more}`}>
        Ver todo el catálogo
      </Link>
    </section>
  );
}
