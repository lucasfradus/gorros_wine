import Link from "next/link";
import { getContent } from "@/lib/content/get";
import { VENTAS_ACTIVAS } from "@/lib/ventas";
import { ContentImage } from "./content-image";
import { Lineas } from "./rich-text";
import styles from "./hero.module.css";

export async function Hero() {
  const [c, local] = await Promise.all([
    getContent("home"),
    getContent("local"),
  ]);

  const claseCta = `btn btnOutline ${styles.cta}`;

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

        {/* Sin catálogo público no hay adónde mandar a alguien que quiere
            comprar, salvo al WhatsApp del local. */}
        {VENTAS_ACTIVAS ? (
          <Link href="/catalogo" className={claseCta}>
            {c.heroCta}
          </Link>
        ) : (
          <a
            href={`https://wa.me/${local.whatsapp}`}
            className={claseCta}
            target="_blank"
            rel="noopener noreferrer"
          >
            {c.heroCta}
          </a>
        )}
      </div>
    </section>
  );
}
