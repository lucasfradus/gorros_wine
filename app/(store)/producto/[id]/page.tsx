import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  formatPrice,
  getWine,
  placeholderDescription,
  relatedWines,
  wines,
} from "@/lib/data";
import { WineCard } from "@/components/wine-card";
import { ProductPurchase } from "@/components/product-purchase";
import styles from "@/components/product.module.css";

export function generateStaticParams() {
  return wines.map((w) => ({ id: String(w.id) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const wine = getWine(Number(id));
  if (!wine) return { title: "Vino no encontrado" };

  return {
    title: `${wine.name} · ${wine.winery}`,
    description: `${wine.name} de ${wine.winery} — ${wine.type} de ${wine.region}. ${formatPrice(wine.priceARS)}.`,
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const wine = getWine(Number(id));
  if (!wine) notFound();

  const specs = [
    { k: "Varietal", v: wine.grape },
    { k: "Cosecha", v: wine.vintage },
    { k: "Guarda", v: wine.aging },
  ];

  return (
    <div className={styles.page}>
      <nav aria-label="Miga de pan" className={styles.crumbs}>
        <Link href="/catalogo" className={styles.crumbLink}>
          Catálogo
        </Link>
        <span aria-hidden="true"> / </span>
        <Link
          href={`/catalogo?tipo=${wine.type}`}
          className={styles.crumbLink}
        >
          {wine.type}
        </Link>
        <span aria-hidden="true"> / </span>
        <span>{wine.name}</span>
      </nav>

      <div className={styles.top}>
        {/* Galería: huecos de foto hasta tener las imágenes reales. */}
        <div className={styles.gallery}>
          <div className={styles.thumbs} aria-hidden="true">
            <span className={styles.thumb} />
            <span className={styles.thumb} />
            <span className={styles.thumb} />
          </div>
          <div className={styles.mainShot}>
            <span className={styles.shotNote} aria-hidden="true">
              [ foto botella · alta ]
            </span>
          </div>
        </div>

        <div className={styles.info}>
          <p className={styles.origin}>
            {wine.winery} · {wine.region}
          </p>

          <h1 className={styles.name}>{wine.name}</h1>

          <div className={styles.priceRow}>
            <span className={styles.price}>{formatPrice(wine.priceARS)}</span>
            <span className={styles.stock}>En stock · retiro hoy</span>
          </div>

          <p className={styles.desc}>{placeholderDescription}</p>

          <dl className={styles.specs}>
            {specs.map((s) => (
              <div key={s.k} className={styles.spec}>
                <dt className={styles.specKey}>{s.k}</dt>
                <dd className={styles.specVal}>{s.v}</dd>
              </div>
            ))}
          </dl>

          <ProductPurchase wine={wine} />

          <p className={styles.shipping}>
            <span>◦ Envío en Pilar y zona</span>
            <span>◦ Retiro en el local</span>
          </p>

          <div className={styles.pairings}>
            <h2 className={styles.pairingsTitle}>Maridajes sugeridos</h2>
            <ul className={styles.pairingList}>
              {wine.pairings.map((p) => (
                <li key={p} className={styles.pairing}>
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <section className={styles.related} aria-labelledby="relacionados">
        <h2 id="relacionados" className={styles.relatedTitle}>
          También te puede gustar
        </h2>
        <div className={styles.relatedGrid}>
          {relatedWines(wine).map((w) => (
            <WineCard key={w.id} wine={w} />
          ))}
        </div>
      </section>
    </div>
  );
}
