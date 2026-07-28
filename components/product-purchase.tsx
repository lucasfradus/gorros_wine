"use client";

import { useState } from "react";
import type { Wine } from "@/lib/data";
import { useCart } from "./cart-context";
import styles from "./product.module.css";

const MAX_QTY = 12;

export function ProductPurchase({ wine }: { wine: Wine }) {
  const { add } = useCart();
  const [qty, setQty] = useState(1);

  return (
    <div className={styles.purchase}>
      <div className={styles.stepper}>
        <button
          type="button"
          className={styles.stepBtn}
          onClick={() => setQty((q) => Math.max(1, q - 1))}
          disabled={qty <= 1}
          aria-label="Quitar una unidad"
        >
          −
        </button>
        <output className={styles.qty} aria-live="polite">
          {qty}
        </output>
        <button
          type="button"
          className={styles.stepBtn}
          onClick={() => setQty((q) => Math.min(MAX_QTY, q + 1))}
          disabled={qty >= MAX_QTY}
          aria-label="Agregar una unidad"
        >
          +
        </button>
      </div>

      <button
        type="button"
        className={styles.addToCart}
        onClick={() => add(wine, qty)}
      >
        Agregar al carrito
      </button>
    </div>
  );
}
