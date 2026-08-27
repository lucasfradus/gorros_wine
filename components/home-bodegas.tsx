import type { CSSProperties } from "react";
import Image from "next/image";
import { getBodegasEnHome, type BodegaEnHome } from "@/lib/bodegas";
import { getContent } from "@/lib/content/get";
import { Lineas } from "./rich-text";
import styles from "./home-bodegas.module.css";

/**
 * Cuánto tarda cada logo en recorrer su propio ancho.
 *
 * La duración de la vuelta se calcula con esto y no se fija en el CSS a
 * propósito: si fuera fija, con diez bodegas la franja iría lentísima y con
 * sesenta pasaría volando. Atado a la cantidad, la velocidad en píxeles por
 * segundo es siempre la misma.
 */
const SEGUNDOS_POR_LOGO = 4;

/**
 * La franja de bodegas de la portada.
 *
 * Es un marquee de CSS puro y no un carrusel con estado: acá no hay nada que
 * el visitante elija —son logos que pasan—, así que un client component sólo
 * agregaría JavaScript para hacer lo que `@keyframes` ya hace. Se frena al
 * pasar el mouse y al tabular, y con `prefers-reduced-motion` no se mueve nunca
 * (ver el módulo de estilos).
 *
 * Qué bodegas entran lo decide `lib/bodegas.ts`; qué dice el encabezado, el
 * CMS. Este componente sólo maqueta.
 */
export async function HomeBodegas() {
  const [c, lista] = await Promise.all([getContent("home"), getBodegasEnHome()]);

  // Sin bodegas elegidas no se dibuja nada, igual que la agenda de la home
  // cuando no hay fechas: un encabezado con la franja vacía debajo ensucia la
  // portada y no le informa nada a nadie.
  if (lista.length === 0) return null;

  return (
    <section className={styles.section} aria-labelledby="bodegas">
      <header className={styles.head}>
        <p className={`eyebrow ${styles.eyebrow}`}>{c.bodegasEyebrow}</p>
        <h2 id="bodegas" className={`sectionTitle ${styles.title}`}>
          <Lineas texto={c.bodegasTitulo} />
        </h2>
        <p className={styles.lede}>{c.bodegasLede}</p>
      </header>

      <div className={styles.viewport}>
        <div
          className={styles.track}
          style={
            { "--dur": `${lista.length * SEGUNDOS_POR_LOGO}s` } as CSSProperties
          }
        >
          <ul className={styles.fila}>
            {lista.map((b) => (
              <li key={b.id} className={styles.item}>
                <Chip bodega={b} />
              </li>
            ))}
          </ul>

          {/* La segunda vuelta, que es lo que hace continuo el loop: cuando el
              track se corrió exactamente la mitad, lo que se ve es esta copia
              en la posición donde arrancó la primera. Va sin enlaces y oculta
              para el lector de pantalla, porque es la misma lista dos veces:
              un contenedor `aria-hidden` no puede tener adentro cosas que
              reciban foco. */}
          <ul className={`${styles.fila} ${styles.clon}`} aria-hidden="true">
            {lista.map((b) => (
              <li key={b.id} className={styles.item}>
                <Chip bodega={b} clon />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/**
 * Un logo en su tarjeta clara.
 *
 * La tarjeta no es decoración: los logos que mandan las bodegas vienen mitad
 * con fondo blanco y mitad calados con tinta oscura, y sobre el negro del
 * sitio unos se ven como un rectángulo y los otros no se ven. Un fondo claro
 * los muestra a todos igual, con su color de marca.
 */
function Chip({ bodega, clon = false }: { bodega: BodegaEnHome; clon?: boolean }) {
  const enlazada = Boolean(bodega.sitioWeb) && !clon;

  const logo = (
    <Image
      src={bodega.logo.src}
      /* Enlazada, el nombre accesible lo pone el texto de abajo y la imagen es
         decorativa; suelta, el alt es lo único que la nombra. */
      alt={enlazada || clon ? "" : bodega.logo.alt || bodega.nombre}
      /* Las medidas están guardadas con el logo justamente para esto: sin
         ellas `next/image` no puede reservar la caja y la franja salta al
         cargar. El respaldo es por si alguna fila vieja no las tiene. */
      width={bodega.logo.width ?? 320}
      height={bodega.logo.height ?? 160}
      sizes="168px"
      className={styles.logo}
    />
  );

  if (!enlazada) {
    // Sin sitio web cargado la bodega se muestra igual, pero no es un enlace:
    // un `<a>` sin destino es una promesa que no se cumple.
    return <span className={styles.chip}>{logo}</span>;
  }

  return (
    <a
      className={styles.chip}
      href={bodega.sitioWeb!}
      target="_blank"
      rel="noopener noreferrer"
    >
      {logo}
      <span className="srOnly">
        {bodega.nombre} · sitio oficial (se abre en otra pestaña)
      </span>
    </a>
  );
}
