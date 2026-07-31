import styles from "./legal-page.module.css";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className="eyebrow">Legales</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.updated}>Última actualización: {updated}</p>
      </header>

      <p className={styles.draft}>
        <b className={styles.draftLabel}>Borrador.</b> Este texto es una base
        genérica y todavía no fue revisado por un asesor legal. Antes de
        publicar el sitio hay que validarlo y completar los datos de la razón
        social.
      </p>

      <div className={styles.prose}>{children}</div>
    </div>
  );
}
