import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import styles from "./admin/admin.module.css";

// Se carga acá y no en el layout raíz: la tienda no usa Inter y no tiene por
// qué descargarla. Variable font, así que va sin `weight`.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

/**
 * Marco del área de administración. No monta nada de la tienda: ni nav, ni
 * footer, ni age gate, ni carrito.
 *
 * `robots: noindex` aplica a todo lo que cuelga de acá — el panel nunca
 * debe aparecer en Google, ni siquiera la pantalla de ingreso.
 */
export const metadata: Metadata = {
  title: { default: "Panel", template: "%s · Panel Gorros Wine" },
  robots: { index: false, follow: false },
};

// La barra del navegador en el teléfono acompaña a la barra superior del
// panel, no al negro de la tienda. Sigue al modo del sistema: el modo elegido
// en el panel vive en una cookie que este valor estático no puede leer.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#18181b" },
  ],
};

export default function AdminAreaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={`${inter.variable} ${styles.area}`}>{children}</div>;
}
