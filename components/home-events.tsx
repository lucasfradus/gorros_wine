import Link from "next/link";
import { pastEvents, upcomingEvents } from "@/lib/data";
import { PhotoSlot } from "./photo-slot";
import styles from "./home-events.module.css";

export function HomeEvents() {
  return (
    <section className={styles.section} aria-labelledby="eventos">
      <header className={styles.head}>
        <p className={`eyebrow ${styles.eyebrow}`}>Eventos</p>
        <h2 id="eventos" className={`sectionTitle ${styles.title}`}>
          Se toma, se aprende, se comparte
        </h2>
        <p className={styles.lede}>
          Todos los meses organizamos catas y encuentros en el local. Así se
          vive Gorros Wine.
        </p>
      </header>

      <div className={styles.gallery}>
        {pastEvents.map((e) => (
          <figure key={e.id} className={styles.shot}>
            <PhotoSlot label="Arrastrá una foto de un evento" height={360} />
            <figcaption className={styles.caption}>{e.caption}</figcaption>
          </figure>
        ))}
      </div>

      <ul className={styles.upcoming}>
        {upcomingEvents.map((e) => (
          <li key={e.title} className={styles.event}>
            <p className={styles.date}>
              <span className={styles.day}>{e.day}</span>
              <span className={styles.month}>{e.month}</span>
            </p>
            <div className={styles.detail}>
              <h3 className={styles.name}>{e.title}</h3>
              <p className={styles.meta}>{e.meta}</p>
            </div>
            <Link href="/eventos" className={styles.book}>
              Reservar
              <span className="srOnly"> {e.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
