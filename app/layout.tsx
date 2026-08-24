import type { Metadata, Viewport } from "next";
import { Fraunces, Jost } from "next/font/google";
import { siteUrl } from "@/lib/site";
import "./globals.css";

// Ambas son variable fonts: no se declara `weight`, se usa el rango completo.
const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-fraunces",
});

const jost = Jost({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jost",
});

/**
 * El layout raíz sólo monta `<html>`, `<body>`, las fuentes y los tokens.
 * Todo lo que es "sitio público" (nav, footer, age gate, carrito) vive en
 * `app/(store)/layout.tsx`, y el panel en `app/(admin)/layout.tsx`, porque
 * el admin no debe heredar nada de la tienda.
 */
export const metadata: Metadata = {
  // Necesaria para que las URLs de Open Graph salgan absolutas.
  metadataBase: new URL(siteUrl),
  // Sin `template` acá: cada área define el suyo. Si la raíz tuviera uno,
  // envolvería también al título por defecto de la tienda y la home saldría
  // como "Gorros Wine — Vinoteca boutique en Pilar · Gorros Wine".
  title: "Gorros Wine",
};

// En Next 15 themeColor va en `viewport`, no en `metadata`.
export const viewport: Viewport = {
  themeColor: "#0d0c0b",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-AR" className={`${fraunces.variable} ${jost.variable}`}>
      <body>{children}</body>
    </html>
  );
}
