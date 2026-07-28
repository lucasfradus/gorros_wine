import type { Metadata } from "next";
import { Fraunces, Jost } from "next/font/google";
import { CartProvider } from "@/components/cart-context";
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

export const metadata: Metadata = {
  title: "Gorros Wine — Vinoteca boutique en Pilar",
  description:
    "Selección curada de tintos, blancos y espumantes. Comprá online con retiro en el local o envío a domicilio en Pilar y zona.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-AR" className={`${fraunces.variable} ${jost.variable}`}>
      <body>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
