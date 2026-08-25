import type { Metadata } from "next";
import { getContent } from "@/lib/content/get";
import { AccountView } from "@/components/account-view";

export const metadata: Metadata = {
  title: "Cuenta",
  description: "Ingresá a tu cuenta de Gorros Wine.",
  robots: { index: false },
};

export default async function AccountPage() {
  const local = await getContent("local");
  return <AccountView whatsapp={local.whatsapp} />;
}
