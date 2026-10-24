"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "../admin.module.css";

/**
 * Lo único del marco que necesita el navegador: abrir y cerrar el menú en el
 * teléfono. El contenido del menú (secciones, usuario, salir, modo) lo arma el
 * layout en el servidor y llega como `sidebar`.
 *
 * El menú se guarda abierto *para una ruta* y no como un booleano: al navegar
 * cambia el pathname y queda cerrado solo, sin un efecto que lo resetee
 * después de pintar la página nueva con el panel todavía encima.
 */
export function PanelShell({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [abiertoEn, setAbiertoEn] = useState<string | null>(null);
  const abierto = abiertoEn === pathname;

  const abrirRef = useRef<HTMLButtonElement>(null);
  const cerrarRef = useRef<HTMLButtonElement>(null);

  function cerrar() {
    setAbiertoEn(null);
    abrirRef.current?.focus();
  }

  useEffect(() => {
    if (!abierto) return;

    // El foco entra al panel al abrirlo: si no, quien navega con teclado o
    // lector de pantalla sigue parado detrás del velo.
    cerrarRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setAbiertoEn(null);
        abrirRef.current?.focus();
      }
    }

    // Con el panel abierto, la página de atrás no scrollea.
    const html = document.documentElement;
    const overflowPrevio = html.style.overflow;
    html.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);

    return () => {
      html.style.overflow = overflowPrevio;
      document.removeEventListener("keydown", onKey);
    };
  }, [abierto]);

  return (
    <>
      <header className={styles.topbar}>
        <button
          ref={abrirRef}
          type="button"
          className={styles.iconBtn}
          aria-label="Abrir menú"
          aria-expanded={abierto}
          aria-controls="panel-menu"
          onClick={() => setAbiertoEn(pathname)}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <Link href="/admin" className={styles.topbarBrand}>
          Gorros Wine
        </Link>
      </header>

      <aside
        id="panel-menu"
        className={styles.sidebar}
        data-open={abierto ? "" : undefined}
      >
        <button
          ref={cerrarRef}
          type="button"
          className={`${styles.iconBtn} ${styles.menuClose}`}
          aria-label="Cerrar menú"
          onClick={cerrar}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
        {sidebar}
      </aside>

      {abierto ? (
        <div className={styles.scrim} onClick={cerrar} aria-hidden="true" />
      ) : null}

      <main className={styles.main}>{children}</main>
    </>
  );
}
