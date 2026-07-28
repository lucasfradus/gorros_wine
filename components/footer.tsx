import styles from "./footer.module.css";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <p className={styles.logo}>GORROS WINE</p>
      <p className={styles.meta}>
        Pilar, Buenos Aires · Envíos y retiro en tienda
      </p>
    </footer>
  );
}
