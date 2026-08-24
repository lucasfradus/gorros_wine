import type { Metadata } from "next";
import { CatalogView } from "@/components/catalog-view";
import { wineTypes, type WineType } from "@/lib/data";

export const metadata: Metadata = {
  title: "Catálogo",
  description:
    "Todos nuestros vinos: tintos, blancos, espumantes y rosados. Envíos en Pilar y zona, retiro en el local.",
};

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  // Se lee acá, en el servidor, y no con useSearchParams en el cliente: así
  // la grilla llega ya renderizada en el HTML en vez de aparecer al hidratar.
  const { tipo } = await searchParams;
  const initialType = wineTypes.includes(tipo as WineType)
    ? (tipo as WineType)
    : undefined;

  return <CatalogView initialType={initialType} />;
}
