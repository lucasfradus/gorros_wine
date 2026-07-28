import type { Metadata } from "next";
import { events } from "@/lib/data";
import { PhotoSlot } from "@/components/photo-slot";
import styles from "./eventos.module.css";

export const metadata: Metadata = {
  title: "Eventos",
  description:
    "Catas y encuentros en Gorros Wine, Pilar. Cupos limitados: reservás online y pagás en el local.",
};

export default function EventsPage() {
  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={`eyebrow ${styles.eyebrow}`}>Eventos</p>
        <h1 className={styles.title}>Catas y encuentros</h1>
        <p className={styles.lede}>
          Vení a probar, aprender y compartir. Cupos limitados — reservás online
          y pagás en el local.
        </p>
      </header>

      <div className={styles.gallery}>
        <PhotoSlot label="Foto de un evento pasado" height={300} />
        <PhotoSlot label="Foto de un evento pasado" height={300} />
      </div>

      <ul className={styles.list}>
        {events.map((e) => (
          <li key={e.title} className={styles.event}>
            <p className={styles.date}>
              <span className={styles.day}>{e.day}</span>
              <span className={styles.month}>{e.month}</span>
            </p>
            <div>
              <h2 className={styles.name}>{e.title}</h2>
              <p className={styles.meta}>{e.meta}</p>
            </div>
            <button type="button" className={styles.book}>
              Reservar · {e.price}
              <span className="srOnly"> {e.title}</span>
            </button>
          </li>
        ))}
      </ul>

      <section className={styles.fair} aria-labelledby="caminos">
        <p className={`eyebrow ${styles.fairEyebrow}`}>Caminos del Vino</p>
        <h2 id="caminos" className={styles.fairTitle}>
          Nuestra feria del vino
        </h2>
        <p className={styles.fairBody}>
          Un encuentro con bodegas invitadas, degustaciones abiertas y las
          historias detrás de cada etiqueta.
        </p>
        <button type="button" className="btn btnOutline">
          Más información
        </button>
      </section>

      <section className={styles.private}>
        <div>
          <h2 className={styles.privateTitle}>¿Armamos una cata privada?</h2>
          <p className={styles.privateBody}>
            Cumpleaños, empresas o con amigos. La organizamos a tu medida.
          </p>
        </div>
        <a href="mailto:hola@gorroswine.com" className="btn btnGold">
          Escribinos
        </a>
      </section>
    </div>
  );
}
