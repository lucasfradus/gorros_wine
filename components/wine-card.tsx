"use client";

import Link from "next/link";
import type { Wine } from "@/lib/data";
import { useCart } from "./cart-context";
import styles from "./wine-card.module.css";

export function WineCard({ wine }: { wine: Wine }) {
  const { add } = useCart();

  return (
    <article className={styles.card}>
      {/* Hueco de foto de la botella. */}
      <div className={styles.figure}>
        <span className={styles.figureNote} aria-hidden="true">
          [ botella ]
        </span>
      </div>

      <p className={styles.type}>{wine.type}</p>

      <h3 className={styles.name}>
        <Link href={`/producto/${wine.id}`} className={styles.nameLink}>
          {wine.name}
        </Link>
      </h3>

      <p className={styles.winery}>{wine.winery}</p>
      <p className={styles.price}>{wine.price}</p>

      <button type="button" className={styles.add} onClick={() => add(wine)}>
        Agregar
        <span className="srOnly"> {wine.name} al carrito</span>
      </button>
    </article>
  );
}
