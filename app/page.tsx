import { Nav } from "@/components/nav";
import { Hero } from "@/components/hero";
import { Categories } from "@/components/categories";
import { FeaturedWines } from "@/components/featured-wines";
import { ClubBand } from "@/components/club-band";
import { Footer } from "@/components/footer";

export default function Home() {
  return (
    <div className="shell">
      <Nav />
      <main>
        <Hero />
        <Categories />
        <FeaturedWines />
        <ClubBand />
      </main>
      <Footer />
    </div>
  );
}
