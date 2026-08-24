import type { Metadata } from "next";
import { CartProvider } from "@/components/cart-context";
import { AgeGate, ageGateScript } from "@/components/age-gate";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";

const title = "Gorros Wine — Vinoteca boutique en Pilar";
const description =
  "Selección curada de tintos, blancos y espumantes. Comprá online con retiro en el local o envío a domicilio en Pilar y zona.";

export const metadata: Metadata = {
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

/** Sitio público: age gate, carrito y el marco de nav + footer. */
export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
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
    </>
  );
}
