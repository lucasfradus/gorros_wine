import type { Metadata } from "next";
import { getContent } from "@/lib/content/get";
import { LegalPage } from "@/components/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  const c = await getContent("legalesPrivacidad");
  return { title: c.seoTitulo, description: c.seoDescripcion };
}

export default function PrivacyPage() {
  return <LegalPage grupo="legalesPrivacidad" />;
}
