import { Hero } from "@/components/hero";
import { Benefits } from "@/components/benefits";
import { FeaturedWines } from "@/components/featured-wines";
import { ClubBand } from "@/components/club-band";
import { HomeEvents } from "@/components/home-events";
import { AboutTeaser } from "@/components/about-teaser";
import { HomeBodegas } from "@/components/home-bodegas";
import { Reviews } from "@/components/reviews";
import { HowToBuy } from "@/components/how-to-buy";
import { VENTAS_ACTIVAS } from "@/lib/ventas";

export default function Home() {
  return (
    <>
      <Hero />
      <Benefits />
      {/* Las dos secciones que venden: la selección con precios y los pasos
          para comprar. Vuelven solas cuando el catálogo tenga datos reales. */}
      {VENTAS_ACTIVAS && <FeaturedWines />}
      <ClubBand />
      <HomeEvents />
      <AboutTeaser />
      <HomeBodegas />
      <Reviews />
      {VENTAS_ACTIVAS && <HowToBuy />}
    </>
  );
}
