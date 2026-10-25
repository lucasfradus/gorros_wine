import { redirect } from "next/navigation";

/**
 * La lista de comprobantes pasó a ser el inicio de Facturación. Esto queda para
 * que los links viejos (y los favoritos) sigan andando, con sus filtros.
 */
export default async function ComprobantesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) {
    if (typeof v === "string") qs.set(k, v);
  }
  redirect(qs.size ? `/admin/facturacion?${qs}` : "/admin/facturacion");
}
