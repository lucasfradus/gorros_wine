import { ISOTIPO_PATH, ISOTIPO_PATH_ICONO } from "./isotipo-path";

/**
 * Tamaño a partir del cual se usa el trazo fiel del original.
 *
 * El trazo real de la marca mide el 1,93% de su ancho, así que por debajo de
 * ~56px no llega a 1px y el símbolo se ve arácnido (y directamente gris a 32px).
 * Debajo de ese umbral va el peso dilatado, que es la misma geometría con el
 * trazo engordado al 3,95% — a 26px da 1px limpio.
 *
 * Es un tamaño óptico, no dos logos: el símbolo es el mismo y ocupa la misma
 * caja. Quien lo usa elige el tamaño y nada más.
 */
const UMBRAL_PESO_FINO = 56;

/**
 * El símbolo de la marca, en SVG inline.
 *
 * Va inline y no como `<img>` para que herede el color del contexto: el mismo
 * componente sale rojo en el nav y podría salir dorado en otro lado sin
 * duplicar el archivo. Los paths los genera `scripts/_isotipo.mjs`.
 *
 * Siempre `aria-hidden`: en todos los lugares donde se usa está acompañado del
 * wordmark "Gorros Wine" en texto, así que anunciarlo sería repetir el nombre.
 */
export function Isotipo({
  size = 24,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 1000 1000"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d={size >= UMBRAL_PESO_FINO ? ISOTIPO_PATH : ISOTIPO_PATH_ICONO}
      />
    </svg>
  );
}
