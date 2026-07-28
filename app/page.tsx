import { Hero } from "@/components/hero";
import { Categories } from "@/components/categories";
import { FeaturedWines } from "@/components/featured-wines";
import { ClubBand } from "@/components/club-band";

export default function Home() {
  return (
    <>
      <Hero />
      <Categories />
      <FeaturedWines />
      <ClubBand />
    </>
  );
}
