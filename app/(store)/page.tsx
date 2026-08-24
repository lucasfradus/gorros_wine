import { Hero } from "@/components/hero";
import { Benefits } from "@/components/benefits";
import { FeaturedWines } from "@/components/featured-wines";
import { ClubBand } from "@/components/club-band";
import { HomeEvents } from "@/components/home-events";
import { AboutTeaser } from "@/components/about-teaser";
import { Reviews } from "@/components/reviews";
import { HowToBuy } from "@/components/how-to-buy";

export default function Home() {
  return (
    <>
      <Hero />
      <Benefits />
      <FeaturedWines />
      <ClubBand />
      <HomeEvents />
      <AboutTeaser />
      <Reviews />
      <HowToBuy />
    </>
  );
}
