"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Wine } from "@/lib/data";
import { MAX_QTY, useCart } from "./cart-context";
import styles from "./product.module.css";

export function ProductPurchase({ wine }: { wine: Wine }) {
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Si se desmonta con el aviso puesto, no dejar el timer colgado.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function addToCart() {
    add(wine, qty);
    setAdded(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), 4000);
  }

  return (
    <>
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
          <output className={styles.qty}>{qty}</output>
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

        <button type="button" className={styles.addToCart} onClick={addToCart}>
          Agregar al carrito
        </button>
      </div>

      <p className={styles.added} role="status">
        {added && (
          <>
            Agregado al carrito.{" "}
            <Link href="/carrito" className={styles.addedLink}>
              Ver carrito
            </Link>
          </>
        )}
      </p>
    </>
  );
}
