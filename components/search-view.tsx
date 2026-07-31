"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { wines } from "@/lib/data";
import { WineCard } from "./wine-card";
import styles from "./search-view.module.css";

/** Sin acentos y en minúscula, para que "torrontes" encuentre "Torrontés".
 *  El rango se escribe con escapes y no con los signos literales, que se
 *  corrompen fácil al reescribir el archivo. */
function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function SearchView({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);

  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return [];
    // Cada palabra tiene que aparecer en algún campo del vino.
    const terms = q.split(/\s+/);
    return wines.filter((w) => {
      const haystack = normalize(
        [w.name, w.winery, w.type, w.grape, w.region].join(" "),
      );
      return terms.every((t) => haystack.includes(t));
    });
  }, [query]);

  const searched = query.trim().length > 0;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className="eyebrow">Buscar</p>
        <h1 className={styles.title}>¿Qué estás buscando?</h1>
      </header>

      <div className={styles.field}>
        <label htmlFor="q" className="srOnly">
          Buscar vinos por nombre, bodega, uva o región
        </label>
        <input
          id="q"
          type="search"
          className={styles.input}
          placeholder="Malbec, Mendoza, espumante…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      <p className={styles.status} role="status">
        {searched &&
          (results.length === 0
            ? "Ninguna etiqueta coincide."
            : `${results.length} ${results.length === 1 ? "resultado" : "resultados"}`)}
      </p>

      {searched && results.length > 0 && (
        <div className={styles.grid}>
          {results.map((w) => (
            <WineCard key={w.id} wine={w} showRegion />
          ))}
        </div>
      )}

      {searched && results.length === 0 && (
        <div className={styles.empty}>
          <p className={styles.emptyText}>
            Probá con otra palabra, o mirá el catálogo completo.
          </p>
          <Link href="/catalogo" className="btn btnOutline">
            Ver catálogo
          </Link>
        </div>
      )}
    </div>
  );
}
