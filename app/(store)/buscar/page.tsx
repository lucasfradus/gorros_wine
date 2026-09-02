import type { Metadata } from "next";
import { SearchView } from "@/components/search-view";
import { requireVentas } from "@/lib/ventas";

export const metadata: Metadata = {
  title: "Buscar",
  description: "Buscá vinos por nombre, bodega, uva o región.",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  requireVentas();

  const { q } = await searchParams;
  return <SearchView initialQuery={q ?? ""} />;
}
