import type { Metadata } from "next";
import { getContent } from "@/lib/content/get";
import { CartProvider } from "@/components/cart-context";
import { AgeGate, ageGateScript } from "@/components/age-gate";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";

export async function generateMetadata(): Promise<Metadata> {
  const c = await getContent("sitio");
  const title = c.titulo;
  const description = c.descripcion;

  return {
    title: { default: title, template: "%s · Gorros Wine" },
    description,
    openGraph: {
      type: "website",
      locale: "es_AR",
      siteName: "Gorros Wine",
      title,
      description,
      images: c.imagenCompartir
        ? [
            {
              url: c.imagenCompartir.src,
              width: c.imagenCompartir.width ?? 1200,
              height: c.imagenCompartir.height ?? 800,
              alt: c.imagenCompartir.alt,
            },
          ]
        : undefined,
    },
    twitter: { card: "summary_large_image" },
  };
}

/** Sitio público: age gate, carrito y el marco de nav + footer. */
export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const edad = await getContent("edad");

  return (
    <>
      {/* Corre antes de que se pinte el resto del body. */}
      <script dangerouslySetInnerHTML={{ __html: ageGateScript }} />
      <AgeGate copy={edad} />
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
