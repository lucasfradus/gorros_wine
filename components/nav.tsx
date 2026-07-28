"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navLinks } from "@/lib/data";
import { useCart } from "./cart-context";
import styles from "./nav.module.css";

export function Nav() {
  const { count } = useCart();
  const pathname = usePathname();

  return (
    <header className={styles.nav}>
      <Link href="/" className={styles.logo}>
        GORROS WINE
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

      <div className={styles.right}>
        <Link href="/buscar" className={styles.util}>
          Buscar
        </Link>
        <Link href="/cuenta" className={styles.util}>
          Cuenta
        </Link>
        <Link href="/carrito" className={styles.cart}>
          Carrito ({count})
          <span className="srOnly">
            {count === 1 ? " 1 producto" : ` ${count} productos`}
          </span>
        </Link>
      </div>
    </header>
  );
}
