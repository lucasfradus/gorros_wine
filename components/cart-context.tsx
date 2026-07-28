"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Wine } from "@/lib/data";

interface CartValue {
  count: number;
  add: (wine: Wine) => void;
}

const CartContext = createContext<CartValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);

  const add = useCallback((_wine: Wine) => {
    // Por ahora sólo lleva la cuenta: el carrito real llega con el checkout.
    setCount((c) => c + 1);
  }, []);

  const value = useMemo(() => ({ count, add }), [count, add]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de <CartProvider>");
  return ctx;
}
