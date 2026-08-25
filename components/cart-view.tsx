"use client";

import Link from "next/link";
import { formatPrice } from "@/lib/data";
import { MAX_QTY, useCart } from "./cart-context";
import styles from "./cart-view.module.css";

/** Arma el pedido como texto para mandar por WhatsApp. */
function orderMessage(
  lines: { wine: { name: string; winery: string }; qty: number }[],
  subtotal: number,
) {
  const items = lines
    .map((l) => `· ${l.qty}× ${l.wine.name} (${l.wine.winery})`)
    .join("\n");
  return `Hola! Quiero hacer este pedido:\n\n${items}\n\nSubtotal: ${formatPrice(subtotal)}`;
}

/** El número llega por props: acá no se puede leer la base. */
export function CartView({ whatsapp }: { whatsapp: string }) {
  const { lines, count, subtotal, ready, setQty, remove, clear } = useCart();

  // Hasta leer localStorage no se sabe si está vacío: mostrar "vacío" acá
  // haría parpadear el mensaje en cada carga.
  if (!ready) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Tu carrito</h1>
        <p className={styles.loading}>Cargando…</p>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Tu carrito</h1>
        <div className={styles.empty}>
          <p className={styles.emptyText}>Todavía no agregaste ninguna etiqueta.</p>
          <Link href="/catalogo" className="btn btnGold">
            Ver el catálogo
          </Link>
        </div>
      </div>
    );
  }

  const waHref = `https://wa.me/${whatsapp}?text=${encodeURIComponent(
    orderMessage(lines, subtotal),
  )}`;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className="eyebrow">Carrito</p>
        <h1 className={styles.title}>Tu pedido</h1>
        <p className={styles.count}>
          {count} {count === 1 ? "botella" : "botellas"} ·{" "}
          {lines.length === 1 ? "1 etiqueta" : `${lines.length} etiquetas`}
        </p>
      </header>

      <div className={styles.layout}>
        <ul className={styles.lines}>
          {lines.map((l) => (
            <li key={l.wine.id} className={styles.line}>
              <div className={styles.thumb} aria-hidden="true">
                <span className={styles.thumbNote}>[ botella ]</span>
              </div>

              <div className={styles.info}>
                <p className={styles.type}>{l.wine.type}</p>
                <h2 className={styles.name}>
                  <Link
                    href={`/producto/${l.wine.id}`}
                    className={styles.nameLink}
                  >
                    {l.wine.name}
                  </Link>
                </h2>
                <p className={styles.winery}>
                  {l.wine.winery} · {l.wine.region}
                </p>
                <p className={styles.unit}>
                  {formatPrice(l.wine.priceARS)} c/u
                </p>
              </div>

              <div className={styles.qtyCol}>
                <div className={styles.stepper}>
                  <button
                    type="button"
                    className={styles.stepBtn}
                    onClick={() => setQty(l.wine.id, l.qty - 1)}
                    aria-label={`Quitar una unidad de ${l.wine.name}`}
                  >
                    −
                  </button>
                  <span className={styles.qty}>{l.qty}</span>
                  <button
                    type="button"
                    className={styles.stepBtn}
                    onClick={() => setQty(l.wine.id, l.qty + 1)}
                    disabled={l.qty >= MAX_QTY}
                    aria-label={`Agregar una unidad de ${l.wine.name}`}
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  className={styles.remove}
                  onClick={() => remove(l.wine.id)}
                >
                  Quitar
                  <span className="srOnly"> {l.wine.name}</span>
                </button>
              </div>

              <p className={styles.lineTotal}>
                {formatPrice(l.wine.priceARS * l.qty)}
              </p>
            </li>
          ))}
        </ul>

        <aside className={styles.summary} aria-label="Resumen del pedido">
          <h2 className={styles.summaryTitle}>Resumen</h2>

          <p className={styles.row}>
            <span>Subtotal</span>
            <span className={styles.subtotal}>{formatPrice(subtotal)}</span>
          </p>

          <p className={styles.note}>
            El envío se coordina al confirmar el pedido. También podés reservar
            y retirar en el local.
          </p>

          <a
            href={waHref}
            className={`btn btnGold ${styles.checkout}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Finalizar por WhatsApp
          </a>

          <Link href="/catalogo" className={`linkUnder ${styles.keep}`}>
            Seguir comprando
          </Link>

          <button type="button" className={styles.clear} onClick={clear}>
            Vaciar carrito
          </button>
        </aside>
      </div>
    </div>
  );
}
