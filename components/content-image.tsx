import Image from "next/image";
import type { ImagenValor } from "@/lib/content/types";
import { PhotoSlot } from "./photo-slot";
import styles from "./content-image.module.css";

/**
 * Una foto del CMS, con el hueco rayado como respaldo.
 *
 * El `<PhotoSlot>` deja de ser un estado permanente del diseño y pasa a ser lo
 * que se ve mientras nadie subió esa foto todavía. Cuando alguien la sube
 * desde el panel, este mismo lugar la muestra sin tocar código.
 */
export function ContentImage({
  imagen,
  etiqueta,
  className = "",
  height,
  priority = false,
  sizes = "(max-width: 1180px) 100vw, 1180px",
}: {
  imagen: ImagenValor | null;
  /** Qué foto va acá. Se muestra en el hueco cuando no hay ninguna. */
  etiqueta: string;
  /** La clase que dimensiona el lugar. La misma que usaba el hueco. */
  className?: string;
  height?: number | string;
  priority?: boolean;
  sizes?: string;
}) {
  if (!imagen) {
    return <PhotoSlot label={etiqueta} height={height} className={className} />;
  }

  return (
    <div
      className={`${styles.marco} ${className}`}
      style={height ? { height } : undefined}
    >
      <Image
        src={imagen.src}
        alt={imagen.alt}
        fill
        priority={priority}
        sizes={sizes}
        className={styles.img}
      />
    </div>
  );
}
