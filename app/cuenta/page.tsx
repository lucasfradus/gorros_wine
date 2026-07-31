import type { Metadata } from "next";
import { AccountView } from "@/components/account-view";

export const metadata: Metadata = {
  title: "Cuenta",
  description: "Ingresá a tu cuenta de Gorros Wine.",
  robots: { index: false },
};

export default function AccountPage() {
  return <AccountView />;
}
