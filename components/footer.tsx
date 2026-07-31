import Link from "next/link";
import { NewsletterForm } from "./newsletter-form";
import styles from "./footer.module.css";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.cols}>
        <div>
          <p className={styles.logo}>GORROS WINE</p>
          <p className={styles.blurb}>
            Vinoteca en Pilar, Buenos Aires. Etiquetas de las principales
            bodegas argentinas e internacionales.
          </p>
        </div>

        <div>
          <h2 className={styles.colTitle}>Tienda</h2>
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
          <h2 className={styles.colTitle}>Contacto</h2>
          <ul className={styles.list}>
            <li>Pilar, Buenos Aires</li>
            <li>Lun a Sáb · 10 a 21 hs</li>
            <li>
              <a
                href="https://instagram.com/gorroswine"
                className={styles.link}
                target="_blank"
                rel="noopener noreferrer"
              >
                @gorroswine
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h2 className={styles.colTitle}>Newsletter</h2>
          <p className={styles.blurbSmall}>Novedades y ofertas.</p>
          <NewsletterForm />
        </div>
      </div>

      <div className={styles.legal}>
        <p>
          © 2026 Gorros Wine · Beber con moderación. Prohibida su venta a
          menores de 18 años.
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
