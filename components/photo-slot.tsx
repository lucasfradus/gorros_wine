import styles from "./photo-slot.module.css";

/**
 * Hueco donde va una foto que todavía no se cargó en el proyecto de design.
 * Cuando llegue la imagen, se reemplaza por <Image /> como en el hero.
 */
export function PhotoSlot({
  label,
  height,
  className = "",
}: {
  label: string;
  /** Alto CSS; si se omite, estira al alto del contenedor. */
  height?: number | string;
  className?: string;
}) {
  return (
    <div
      className={`${styles.slot} ${className}`}
      style={height ? { height } : undefined}
      role="img"
      aria-label={`Espacio para foto: ${label}`}
    >
      <span className={styles.label}>{label}</span>
    </div>
  );
}
