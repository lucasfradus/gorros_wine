"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "../admin.module.css";

interface Item {
  href: string;
  label: string;
  section?: string;
}

/**
 * Cliente sólo por `usePathname`, que es lo único que necesita el navegador
 * acá: marcar cuál es la sección abierta.
 */
export function NavLinks({ showUsers }: { showUsers: boolean }) {
  const pathname = usePathname();

  const items: Item[] = [
    { href: "/admin", label: "Inicio" },
    { href: "/admin/cuenta", label: "Mi cuenta", section: "Cuenta" },
  ];

  if (showUsers) {
    items.splice(1, 0, {
      href: "/admin/usuarios",
      label: "Usuarios",
      section: "Sistema",
    });
  }

  return (
    <nav className={styles.nav}>
      {items.map((item) => {
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(item.href);

        return (
          // Fragment y no <div>: así el enlace queda como hijo directo del
          // flex del nav y el layout no se rompe.
          <Fragment key={item.href}>
            {item.section ? (
              <span className={styles.navSection}>{item.section}</span>
            ) : null}
            <Link
              href={item.href}
              className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          </Fragment>
        );
      })}
    </nav>
  );
}
