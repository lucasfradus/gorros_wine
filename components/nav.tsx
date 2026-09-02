"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navLinks } from "@/lib/data";
import { VENTAS_ACTIVAS } from "@/lib/ventas";
import { Isotipo } from "./isotipo";
import { useCart } from "./cart-context";
import styles from "./nav.module.css";

/* El contador vive en su propio componente y no en `Nav`: así `useCart()` se
   llama sólo cuando el carrito se muestra, y sin ventas no hace falta que el
   layout monte el proveedor. */
function CartLink() {
  const { count } = useCart();

  return (
    <Link href="/carrito" className={styles.cart}>
      Carrito ({count})
      <span className="srOnly">
        {count === 1 ? " 1 producto" : ` ${count} productos`}
      </span>
    </Link>
  );
}

export function Nav() {
  const pathname = usePathname();

  return (
    <header className={styles.nav}>
      <Link href="/" className={styles.logo}>
        <Isotipo size={28} className={styles.logoMark} />
        <span>GORROS WINE</span>
      </Link>

      <nav aria-label="Principal">
        <ul className={styles.links}>
          {navLinks.map((link) => {
            // "/#club" no es una ruta: nunca se marca como activa.
            const active = link.href.startsWith("/#")
              ? false
              : pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`${styles.link} ${active ? styles.linkActive : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Buscar, Cuenta y Carrito son las tres puertas a la tienda: sin ventas
          no hay nada del otro lado y el bloque entero no se pinta. */}
      {VENTAS_ACTIVAS && (
        <div className={styles.right}>
          <Link href="/buscar" className={styles.util}>
            Buscar
          </Link>
          <Link href="/cuenta" className={styles.util}>
            Cuenta
          </Link>
          <CartLink />
        </div>
      )}
    </header>
  );
}
