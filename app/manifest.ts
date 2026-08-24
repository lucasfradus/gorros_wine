import type { MetadataRoute } from "next";

/**
 * Manifest de la PWA. Next lo sirve en `/manifest.webmanifest` y lo enlaza
 * solo desde el layout raíz.
 *
 * Los iconos son los que genera `scripts/_isotipo.mjs`: el símbolo va sobre el
 * fondo noche y no transparente, porque quien instala el sitio lo ve contra el
 * fondo del launcher y una marca calada se pierde ahí.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gorros Wine",
    short_name: "Gorros Wine",
    description: "Vinoteca boutique en Pilar, Buenos Aires.",
    lang: "es-AR",
    start_url: "/",
    display: "standalone",
    background_color: "#0d0c0b",
    theme_color: "#0d0c0b",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
