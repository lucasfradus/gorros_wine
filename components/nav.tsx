"use client";

import Link from "next/link";
import { navLinks } from "@/lib/data";
import { useCart } from "./cart-context";
import styles from "./nav.module.css";

export function Nav() {
  const { count } = useCart();

  return (
    <header className={styles.nav}>
      <div className={styles.left}>
        <Link href="/" className={styles.logo}>
          GORROS WINE
        </Link>
        <nav aria-label="Principal">
          <ul className={styles.links}>
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={styles.link}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className={styles.right}>
        <Link href="/buscar" className={styles.util}>
          Buscar
        </Link>
        <Link href="/cuenta" className={styles.util}>
          Cuenta
        </Link>
        <Link href="/carrito" className={styles.cart}>
          Carrito · <span aria-hidden="true">{count}</span>
          <span className="srOnly">
            {count === 1 ? "1 producto" : `${count} productos`}
          </span>
        </Link>
      </div>
    </header>
  );
}
