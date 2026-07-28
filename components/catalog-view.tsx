"use client";

import { useMemo, useState } from "react";
import {
  formatPrice,
  grapeFilters,
  priceBounds,
  sortOptions,
  wineries,
  wineTypes,
  wines,
  type SortValue,
  type WineType,
} from "@/lib/data";
import { WineCard } from "./wine-card";
import styles from "./catalog-view.module.css";

/** Agrega o saca un valor de una lista de filtros activos. */
function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

export function CatalogView({ initialType }: { initialType?: WineType }) {
  // Las categorías de la home enlazan con ?tipo=Tinto; la page lo resuelve
  // en el servidor y lo pasa acá ya validado.
  const [types, setTypes] = useState<WineType[]>(
    initialType ? [initialType] : [],
  );
  const [grapes, setGrapes] = useState<string[]>([]);
  const [selectedWineries, setSelectedWineries] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState(priceBounds.max);
  const [sort, setSort] = useState<SortValue>("recomendados");

  const filtered = useMemo(() => {
    const result = wines.filter((w) => {
      if (types.length && !types.includes(w.type)) return false;
      // Subcadena: "Malbec" alcanza también a los blends "Malbec / Cabernet".
      if (grapes.length && !grapes.some((g) => w.grape.includes(g)))
        return false;
      if (selectedWineries.length && !selectedWineries.includes(w.winery))
        return false;
      if (w.priceARS > maxPrice) return false;
      return true;
    });

    switch (sort) {
      case "precio-asc":
        return [...result].sort((a, b) => a.priceARS - b.priceARS);
      case "precio-desc":
        return [...result].sort((a, b) => b.priceARS - a.priceARS);
      case "nombre":
        return [...result].sort((a, b) => a.name.localeCompare(b.name, "es"));
      default:
        return result;
    }
  }, [types, grapes, selectedWineries, maxPrice, sort]);

  const activeCount =
    types.length +
    grapes.length +
    selectedWineries.length +
    (maxPrice < priceBounds.max ? 1 : 0);

  function clearAll() {
    setTypes([]);
    setGrapes([]);
    setSelectedWineries([]);
    setMaxPrice(priceBounds.max);
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className="eyebrow">Catálogo</p>
        <h1 className={styles.title}>Todos nuestros vinos</h1>
        <p className={styles.count}>
          Mostrando {filtered.length}{" "}
          {filtered.length === 1 ? "etiqueta" : "etiquetas"} · Envíos en Pilar y
          zona · Retiro en el local
        </p>
      </header>

      <div className={styles.layout}>
        <aside className={styles.filters} aria-label="Filtros">
          <FilterGroup title="Tipo">
            {wineTypes.map((t) => (
              <FilterChip
                key={t}
                label={t}
                active={types.includes(t)}
                onClick={() => setTypes(toggle(types, t))}
              />
            ))}
          </FilterGroup>

          <FilterGroup title="Uva">
            {grapeFilters.map((g) => (
              <FilterChip
                key={g}
                label={g}
                active={grapes.includes(g)}
                onClick={() => setGrapes(toggle(grapes, g))}
              />
            ))}
          </FilterGroup>

          <FilterGroup title="Bodega">
            {wineries.map((b) => (
              <FilterChip
                key={b}
                label={b}
                active={selectedWineries.includes(b)}
                onClick={() => setSelectedWineries(toggle(selectedWineries, b))}
              />
            ))}
          </FilterGroup>

          <div className={styles.group}>
            <label htmlFor="precio" className={styles.groupTitle}>
              Precio
            </label>
            <input
              id="precio"
              type="range"
              className={styles.range}
              min={priceBounds.min}
              max={priceBounds.max}
              step={100}
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
            />
            <p className={styles.rangeLabels}>
              <span>{formatPrice(priceBounds.min)}</span>
              <span className={styles.rangeValue}>
                hasta {formatPrice(maxPrice)}
              </span>
            </p>
          </div>

          {activeCount > 0 && (
            <button type="button" className={styles.clear} onClick={clearAll}>
              Limpiar filtros ({activeCount})
            </button>
          )}
        </aside>

        <div>
          <div className={styles.toolbar}>
            <label htmlFor="orden" className="srOnly">
              Ordenar por
            </label>
            <select
              id="orden"
              className={styles.sort}
              value={sort}
              onChange={(e) => setSort(e.target.value as SortValue)}
            >
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  Ordenar: {o.label}
                </option>
              ))}
            </select>
          </div>

          {filtered.length > 0 ? (
            <div className={styles.grid}>
              {filtered.map((wine) => (
                <WineCard key={wine.id} wine={wine} showRegion />
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>
                Ninguna etiqueta coincide con esos filtros.
              </p>
              <button type="button" className={styles.clear} onClick={clearAll}>
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className={styles.group}>
      <legend className={styles.groupTitle}>{title}</legend>
      <div className={styles.chips}>{children}</div>
    </fieldset>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`${styles.chip} ${active ? styles.chipActive : ""}`}
    >
      {label}
    </button>
  );
}
