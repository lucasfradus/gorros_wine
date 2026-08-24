import type { Metadata } from "next";
import { CartView } from "@/components/cart-view";

export const metadata: Metadata = {
  title: "Carrito",
  description: "Tu pedido en Gorros Wine.",
  robots: { index: false },
};

export default function CartPage() {
  return <CartView />;
}
