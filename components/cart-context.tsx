"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getWine, type Wine } from "@/lib/data";

const STORAGE_KEY = "gw-cart";

/** Tope por etiqueta, igual que el selector de la ficha de producto. */
export const MAX_QTY = 12;

export interface CartLine {
  wine: Wine;
  qty: number;
}

interface CartValue {
  lines: CartLine[];
  /** Total de botellas, no de renglones. */
  count: number;
  subtotal: number;
  /** false hasta que se leyó localStorage; evita parpadeos raros en la UI. */
  ready: boolean;
  add: (wine: Wine, qty?: number) => void;
  setQty: (id: number, qty: number) => void;
  remove: (id: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartValue | null>(null);

/** Se guarda sólo id y cantidad: el precio y el nombre salen de lib/data
 *  al releer, así un carrito viejo nunca resucita un precio desactualizado. */
type StoredLine = { id: number; qty: number };

function readStorage(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return (parsed as StoredLine[])
      .map((l) => {
        const wine = getWine(Number(l?.id));
        const qty = Math.floor(Number(l?.qty));
        if (!wine || !Number.isFinite(qty) || qty < 1) return null;
        return { wine, qty: Math.min(qty, MAX_QTY) };
      })
      .filter((l): l is CartLine => l !== null);
  } catch {
    // JSON corrupto o storage bloqueado: se arranca con el carrito vacío.
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  // Arranca vacío para que el primer render del cliente sea igual al del
  // servidor; localStorage se lee recién en el efecto de abajo.
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLines(readStorage());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      const stored: StoredLine[] = lines.map((l) => ({
        id: l.wine.id,
        qty: l.qty,
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // Sin persistencia (incógnito o storage lleno): el carrito sigue
      // funcionando en memoria.
    }
  }, [lines, ready]);

  const add = useCallback((wine: Wine, qty = 1) => {
    setLines((prev) => {
      const found = prev.find((l) => l.wine.id === wine.id);
      if (!found) {
        return [...prev, { wine, qty: Math.min(qty, MAX_QTY) }];
      }
      return prev.map((l) =>
        l.wine.id === wine.id
          ? { ...l, qty: Math.min(l.qty + qty, MAX_QTY) }
          : l,
      );
    });
  }, []);

  const setQty = useCallback((id: number, qty: number) => {
    setLines((prev) =>
      qty < 1
        ? prev.filter((l) => l.wine.id !== id)
        : prev.map((l) =>
            l.wine.id === id ? { ...l, qty: Math.min(qty, MAX_QTY) } : l,
          ),
    );
  }, []);

  const remove = useCallback((id: number) => {
    setLines((prev) => prev.filter((l) => l.wine.id !== id));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartValue>(() => {
    const count = lines.reduce((n, l) => n + l.qty, 0);
    const subtotal = lines.reduce((n, l) => n + l.wine.priceARS * l.qty, 0);
    return { lines, count, subtotal, ready, add, setQty, remove, clear };
  }, [lines, ready, add, setQty, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de <CartProvider>");
  return ctx;
}
