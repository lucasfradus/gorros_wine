import Link from "next/link";
import { getContent } from "@/lib/content/get";
import { Isotipo } from "./isotipo";
import { NewsletterForm } from "./newsletter-form";
import { Lineas } from "./rich-text";
import styles from "./footer.module.css";

export async function Footer() {
  const [c, local] = await Promise.all([
    getContent("footer"),
    getContent("local"),
  ]);

  return (
    <footer className={styles.footer}>
      <div className={styles.cols}>
        <div>
          <p className={styles.logo}>
            <Isotipo size={30} className={styles.logoMark} />
            <span>GORROS WINE</span>
          </p>
          <p className={styles.blurb}>{c.blurb}</p>
        </div>

        <div>
          <h2 className={styles.colTitle}>{c.tiendaTitulo}</h2>
          <ul className={styles.list}>
            <li>
              <Link href="/catalogo" className={styles.link}>
                Catálogo
              </Link>
            </li>
            <li>
              <Link href="/#club" className={styles.link}>
                Club Gorros
              </Link>
            </li>
            <li>
              <Link href="/eventos" className={styles.link}>
                Eventos
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className={styles.colTitle}>{c.contactoTitulo}</h2>
          <ul className={styles.list}>
            <li>{local.direccion}</li>
            <li>{local.horarios}</li>
            <li>
              <a
                href={`https://instagram.com/${local.instagram}`}
                className={styles.link}
                target="_blank"
                rel="noopener noreferrer"
              >
                {`@${local.instagram}`}
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h2 className={styles.colTitle}>{c.newsletterTitulo}</h2>
          <p className={styles.blurbSmall}>{c.newsletterBlurb}</p>
          <NewsletterForm />
        </div>
      </div>

      <div className={styles.legal}>
        <p>
          <Lineas texto={c.legal} />
        </p>
        <p className={styles.legalLinks}>
          <Link href="/terminos" className={styles.link}>
            Términos
          </Link>{" "}
          ·{" "}
          <Link href="/privacidad" className={styles.link}>
            Privacidad
          </Link>
        </p>
      </div>
    </footer>
  );
}
