import Link from "next/link";
import { and, asc, count, eq, ilike } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  bodegas,
  categorias,
  productos,
  type TipoVino,
} from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { TIPOS } from "@/lib/catalogo";
import { opcionesDeCategoria } from "@/lib/categorias";
import { formatDateTime } from "@/lib/format";
import { aPesos, formatearPrecio } from "@/lib/precio";
import { cotizacionVigente } from "@/lib/cotizacion";
import { guardarCotizacionAction } from "./actions";
import { CotizacionForm } from "./producto-forms";
import styles from "../../admin.module.css";

export const metadata = { title: "Productos" };

export default async function ProductosPage({
  searchParams,
}: {
  searchParams: Promise<{
    categoria?: string;
    bodega?: string;
    tipo?: string;
    q?: string;
  }>;
}) {
  await requireUser();

  const filtros = await searchParams;

  // Los filtros vienen de la URL, así que se validan como cualquier entrada:
  // un `?tipo=` inventado tiene que ignorarse, no romper la consulta.
  const categoriaId = z.uuid().safeParse(filtros.categoria).data;
  const bodegaId = z.uuid().safeParse(filtros.bodega).data;
  const tipo = TIPOS.includes(filtros.tipo as TipoVino)
    ? (filtros.tipo as TipoVino)
    : undefined;
  const q = filtros.q?.trim() || undefined;

  const condiciones = [
    categoriaId ? eq(productos.categoriaId, categoriaId) : undefined,
    bodegaId ? eq(productos.bodegaId, bodegaId) : undefined,
    tipo ? eq(productos.tipo, tipo) : undefined,
    q ? ilike(productos.nombre, `%${q}%`) : undefined,
  ].filter(Boolean);

  const [cotizacion, categoriasOpciones, listaBodegas, lista, [total]] =
    await Promise.all([
      cotizacionVigente(),
      opcionesDeCategoria(categoriaId),
      db
        .select({ id: bodegas.id, nombre: bodegas.nombre })
        .from(bodegas)
        .orderBy(asc(bodegas.nombre)),
      db
        .select({
          id: productos.id,
          nombre: productos.nombre,
          tipo: productos.tipo,
          anada: productos.anada,
          precioCentavos: productos.precioCentavos,
          moneda: productos.moneda,
          stock: productos.stock,
          isActive: productos.isActive,
          destacado: productos.destacado,
          categoria: categorias.nombre,
          // `leftJoin` y no `innerJoin`: desde que el catálogo tiene
          // accesorios, hay productos sin bodega, y un inner los escondería.
          bodega: bodegas.nombre,
        })
        .from(productos)
        .innerJoin(categorias, eq(productos.categoriaId, categorias.id))
        .leftJoin(bodegas, eq(productos.bodegaId, bodegas.id))
        .where(condiciones.length ? and(...condiciones) : undefined)
        .orderBy(asc(productos.nombre)),
      db.select({ n: count() }).from(productos),
    ]);

  const hayFiltro = Boolean(categoriaId || bodegaId || tipo || q);
  const sinCategorias = categoriasOpciones.length === 0;

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>Productos</h1>
          <p className={styles.pageSub}>
            Todo lo que se vende: vinos, accesorios, heladeras y regalería.
            Todavía no lo lee la tienda pública, que sigue mostrando el de{" "}
            <code>lib/data.ts</code>.
          </p>
        </div>
        {sinCategorias ? null : (
          <Link
            href="/admin/productos/nuevo"
            className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`}
          >
            Nuevo producto
          </Link>
        )}
      </div>

      <div className={styles.stack}>
        <section className={styles.card}>
          <h2 className={`${styles.label} ${styles.sectionHead}`}>
            Cotización del dólar
          </h2>
          <p className={styles.hint} style={{ marginBottom: 14 }}>
            {cotizacion === null ? (
              <>
                Todavía no hay ninguna cargada. Hasta que la cargues, los
                precios en dólares se muestran sin su equivalente en pesos.
              </>
            ) : (
              <>
                US$ 1 = {formatearPrecio(cotizacion.arsPorUsdCentavos, "ARS")},
                cargada el {formatDateTime(cotizacion.createdAt)}. Cambiarla
                recalcula todos los precios en dólares: no hay que tocar
                producto por producto.
              </>
            )}
          </p>
          <CotizacionForm
            action={guardarCotizacionAction}
            cotizacion={cotizacion?.arsPorUsdCentavos ?? null}
          />
        </section>

        {sinCategorias ? (
          <section className={styles.card}>
            <p className={styles.empty}>
              Primero hay que cargar una categoría: todo producto pertenece a
              una, y es la que decide qué ficha se le pide.
              <br />
              <Link href="/admin/categorias/nueva" className={styles.backLink}>
                Crear la primera categoría →
              </Link>
            </p>
          </section>
        ) : (
          <>
            <section className={styles.card}>
              <h2 className={`${styles.label} ${styles.sectionHead}`}>
                Buscar
              </h2>
              {/* Un GET normal: los filtros quedan en la URL y se pueden
                  compartir o marcar. No hace falta JavaScript. */}
              <form method="get" className={styles.form}>
                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="q">
                      Nombre
                    </label>
                    <input
                      id="q"
                      name="q"
                      type="search"
                      defaultValue={q ?? ""}
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="categoria">
                      Categoría
                    </label>
                    <select
                      id="categoria"
                      name="categoria"
                      defaultValue={categoriaId ?? ""}
                      className={styles.select}
                    >
                      <option value="">Todas</option>
                      {categoriasOpciones.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.etiqueta}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="bodega">
                      Bodega
                    </label>
                    <select
                      id="bodega"
                      name="bodega"
                      defaultValue={bodegaId ?? ""}
                      className={styles.select}
                    >
                      <option value="">Todas</option>
                      {listaBodegas.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="tipo">
                      Tipo
                    </label>
                    <select
                      id="tipo"
                      name="tipo"
                      defaultValue={tipo ?? ""}
                      className={styles.select}
                    >
                      <option value="">Todos</option>
                      {TIPOS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={styles.btnRow}>
                  <button type="submit" className={styles.btn}>
                    Filtrar
                  </button>
                  {hayFiltro ? (
                    <Link
                      href="/admin/productos"
                      className={`${styles.btn} ${styles.btnSmall}`}
                    >
                      Limpiar
                    </Link>
                  ) : null}
                </div>
              </form>
            </section>

            <section className={`${styles.card} ${styles.cardTight}`}>
              {lista.length === 0 ? (
                <p className={styles.empty}>
                  {total.n === 0
                    ? "Todavía no hay productos cargados."
                    : "Ningún producto coincide con esos filtros."}
                </p>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th scope="col">Producto</th>
                        <th scope="col">Categoría</th>
                        <th scope="col">Precio</th>
                        <th scope="col">Stock</th>
                        <th scope="col">Estado</th>
                        <th scope="col" />
                      </tr>
                    </thead>
                    <tbody>
                      {lista.map((p) => {
                        const enPesos = aPesos(
                          p.precioCentavos,
                          p.moneda,
                          cotizacion?.arsPorUsdCentavos ?? null,
                        );

                        return (
                          <tr key={p.id}>
                            <td>
                              <span className={styles.cellName}>
                                {p.nombre}
                                {p.destacado ? (
                                  <span className={styles.you}>destacado</span>
                                ) : null}
                              </span>
                              <span className={styles.cellMail}>
                                {p.bodega ?? "—"}
                                {p.anada ? ` · ${p.anada}` : ""}
                              </span>
                            </td>
                            <td className={styles.cellDim}>
                              {p.categoria}
                              {p.tipo ? ` · ${p.tipo}` : ""}
                            </td>
                            <td>
                              <span className={styles.cellName}>
                                {formatearPrecio(p.precioCentavos, p.moneda)}
                              </span>
                              {p.moneda === "USD" ? (
                                <span className={styles.cellMail}>
                                  {enPesos === null
                                    ? "sin cotización"
                                    : `≈ ${formatearPrecio(enPesos, "ARS")}`}
                                </span>
                              ) : null}
                            </td>
                            <td>
                              <span
                                className={`${styles.badge} ${
                                  p.stock === 0 ? styles.badgeOff : ""
                                }`}
                              >
                                {p.stock === 0 ? "Sin stock" : p.stock}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`${styles.badge} ${
                                  p.isActive ? styles.badgeOn : styles.badgeOff
                                }`}
                              >
                                {p.isActive ? "Activo" : "Archivado"}
                              </span>
                            </td>
                            <td className={styles.cellRight}>
                              <Link
                                href={`/admin/productos/${p.id}`}
                                className={`${styles.btn} ${styles.btnSmall}`}
                              >
                                Editar
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}
