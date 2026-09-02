import type { Metadata } from "next";
import Link from "next/link";
import { getContent } from "@/lib/content/get";
import { VENTAS_ACTIVAS } from "@/lib/ventas";
import { ContentImage } from "@/components/content-image";
import { Lineas, Parrafos } from "@/components/rich-text";
import styles from "./nosotros.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const c = await getContent("nosotros");
  return { title: c.seoTitulo, description: c.seoDescripcion };
}

export default async function AboutPage() {
  const [c, local] = await Promise.all([
    getContent("nosotros"),
    getContent("local"),
  ]);

  return (
    <>
      <section className={styles.intro}>
        <div className={styles.copy}>
          <p className={`eyebrow ${styles.eyebrow}`}>{c.eyebrow}</p>

          <h1 className={styles.title}>
            <Lineas texto={c.titulo} clases={{ acento: styles.accent }} />
          </h1>

          <Parrafos
            texto={c.cuerpo}
            className={styles.para}
            clases={{ acento: styles.strongGold, destacado: styles.strong }}
          />
        </div>

        <ContentImage
          imagen={c.imagen}
          etiqueta="Foto del local / Gonzalo y Agustina"
          className={styles.shot}
          sizes="(max-width: 900px) 100vw, 560px"
        />
      </section>

      <ul className={styles.values}>
        {c.valores.map((v, i) => (
          <li key={i} className={styles.value}>
            <h2 className={styles.valueTitle}>{v.title}</h2>
            <p className={styles.valueBody}>{v.body}</p>
          </li>
        ))}
      </ul>

      <section className={styles.closing}>
        <p className={`eyebrow ${styles.closingEyebrow}`}>{c.cierreEyebrow}</p>
        <p className={styles.closingTitle}>
          <Lineas texto={c.cierreTitulo} clases={{ acento: styles.accent }} />
        </p>
        <p className={styles.closingSub}>{c.cierreSub}</p>
        {/* Mientras no haya catálogo público, el cierre lleva al WhatsApp del
            local, igual que el del Club. */}
        {VENTAS_ACTIVAS ? (
          <Link href="/catalogo" className="btn btnGold">
            {c.cierreCta}
          </Link>
        ) : (
          <a
            href={`https://wa.me/${local.whatsapp}`}
            className="btn btnGold"
            target="_blank"
            rel="noopener noreferrer"
          >
            {c.cierreCta}
          </a>
        )}
      </section>
    </>
  );
}
