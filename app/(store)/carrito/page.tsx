import type { Metadata } from "next";
import { getContent } from "@/lib/content/get";
import { CartView } from "@/components/cart-view";

export const metadata: Metadata = {
  title: "Carrito",
  description: "Tu pedido en Gorros Wine.",
  robots: { index: false },
};

export default async function CartPage() {
  const local = await getContent("local");
  return <CartView whatsapp={local.whatsapp} />;
}
