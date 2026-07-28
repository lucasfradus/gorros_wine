import { featuredWines } from "@/lib/data";
import { WineCard } from "./wine-card";
import styles from "./featured-wines.module.css";

export function FeaturedWines() {
  return (
    <section className={styles.section} aria-labelledby="destacados">
      <header className={styles.header}>
        <p className={`eyebrow ${styles.eyebrow}`}>Selección del sommelier</p>
        <h2 id="destacados" className={styles.title}>
          Etiquetas destacadas
        </h2>
      </header>

      <div className={styles.grid}>
        {featuredWines.map((wine) => (
          <WineCard key={wine.id} wine={wine} />
        ))}
      </div>
    </section>
  );
}
