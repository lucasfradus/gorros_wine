import type { Metadata } from "next";
import { shop } from "@/lib/data";
import styles from "./club.module.css";

export const metadata: Metadata = {
  title: "Club Gorros",
  description:
    "Tres etiquetas seleccionadas cada mes, precios de socio y acceso prioritario a las catas. Sin permanencia.",
};

const includes = [
  {
    title: "Tres etiquetas por mes",
    body: "Una selección armada por nosotros, con notas de cata y maridajes para cada botella.",
  },
  {
    title: "Precios de socio",
    body: "Descuento sobre todo el catálogo, todo el año, también fuera de la caja mensual.",
  },
  {
    title: "Catas primero",
    body: "Acceso prioritario a los encuentros del local y lugares reservados antes de la venta general.",
  },
];

const how = [
  { n: "01", title: "Te sumás", body: "Nos escribís y armamos tu perfil de gusto." },
  { n: "02", title: "Recibís", body: "Todos los meses preparamos tu caja: la retirás o te la llevamos." },
  { n: "03", title: "Descubrís", body: "Probás, nos contás, y afinamos la selección del mes siguiente." },
];

export default function ClubPage() {
  const waHref = `https://wa.me/${shop.whatsapp}?text=${encodeURIComponent(
    "Hola! Quiero sumarme al Club Gorros.",
  )}`;

  return (
    <>
      <section className={styles.head}>
        <p className={`eyebrow ${styles.eyebrow}`}>Club Gorros</p>
        <h1 className={styles.title}>
          Una membresía para quienes <em className={styles.accent}>viven</em> el
          vino.
        </h1>
        <p className={styles.lede}>
          Tres etiquetas seleccionadas cada mes, precios de socio y acceso
          prioritario a las catas. Cancelás cuando quieras, sin permanencia.
        </p>
        <a
          href={waHref}
          className="btn btnGold"
          target="_blank"
          rel="noopener noreferrer"
        >
          Sumarme al club
        </a>
      </section>

      <ul className={styles.includes}>
        {includes.map((i) => (
          <li key={i.title} className={styles.include}>
            <h2 className={styles.includeTitle}>{i.title}</h2>
            <p className={styles.includeBody}>{i.body}</p>
          </li>
        ))}
      </ul>

      <section className={styles.how} aria-labelledby="como-funciona">
        <h2 id="como-funciona" className={styles.howTitle}>
          Cómo funciona
        </h2>
        <ol className={styles.steps}>
          {how.map((s) => (
            <li key={s.n} className={styles.step}>
              <p className={styles.num} aria-hidden="true">
                {s.n}
              </p>
              <h3 className={styles.stepTitle}>{s.title}</h3>
              <p className={styles.stepBody}>{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.closing}>
        <p className={styles.closingTitle}>
          ¿Lo querés de regalo? También armamos membresías para regalar.
        </p>
        <a
          href={waHref}
          className="btn btnOutline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Escribinos
        </a>
      </section>
    </>
  );
}
