import type { Metadata } from "next";
import { Fraunces, Jost } from "next/font/google";
import { CartProvider } from "@/components/cart-context";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
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
  title: {
    default: "Gorros Wine — Vinoteca boutique en Pilar",
    template: "%s · Gorros Wine",
  },
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
        <CartProvider>
          <div className="shell">
            <Nav />
            <main>{children}</main>
            <Footer />
          </div>
        </CartProvider>
      </body>
    </html>
  );
}
