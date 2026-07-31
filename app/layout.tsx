import type { Metadata, Viewport } from "next";
import { Fraunces, Jost } from "next/font/google";
import { siteUrl } from "@/lib/site";
import { CartProvider } from "@/components/cart-context";
import { AgeGate, ageGateScript } from "@/components/age-gate";
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

const title = "Gorros Wine — Vinoteca boutique en Pilar";
const description =
  "Selección curada de tintos, blancos y espumantes. Comprá online con retiro en el local o envío a domicilio en Pilar y zona.";

export const metadata: Metadata = {
  // Necesaria para que las URLs de Open Graph salgan absolutas.
  metadataBase: new URL(siteUrl),
  title: { default: title, template: "%s · Gorros Wine" },
  description,
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: "Gorros Wine",
    title,
    description,
    images: [
      {
        url: "/hero-home.webp",
        width: 1200,
        height: 800,
        alt: "La cava de Gorros Wine",
      },
    ],
  },
  twitter: { card: "summary_large_image" },
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
      <body>
        {/* Corre antes de que se pinte el resto del body. */}
        <script dangerouslySetInnerHTML={{ __html: ageGateScript }} />
        <AgeGate />
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
