import type { Metadata } from "next";
import { getContent } from "@/lib/content/get";
import { LegalPage } from "@/components/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  const c = await getContent("legalesTerminos");
  return { title: c.seoTitulo, description: c.seoDescripcion };
}

export default function TermsPage() {
  return <LegalPage grupo="legalesTerminos" />;
}
