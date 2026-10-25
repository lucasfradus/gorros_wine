import Link from "next/link";
import { and, desc, eq, gte, ilike, inArray, lt, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { comprobantes, cuentasMp, movimientosMp } from "@/lib/db/schema";
import { requireFacturacion } from "@/lib/auth";
import { formatARS, formatDateTime, hoyEnArgentina } from "@/lib/format";
import {
  sePuedeFacturar,
  situacionDe,
  type ComprobanteResumen,
  type EstadoFacturacion,
} from "@/lib/facturacion/estado";
import { AutoRefresh } from "../auto-refresh";
import { SyncForm } from "../sync-form";
import styles from "../../../admin.module.css";
import propios from "../facturacion.module.css";

export const metadata = { title: "Cobros de Mercado Pago" };

const FILTROS = {
  sin_facturar: "Sin facturar",
  en_proceso: "En proceso",
  facturado: "Facturados",
  con_error: "Con error",
  todos: "Todos",
} as const;
type Filtro = keyof typeof FILTROS;
const esFiltro = (v?: string): v is Filtro => v !== undefined && v in FILTROS;

/** Tope de filas: con un período razonable no se llega, y si se llega, la
 *  página sigue respondiendo rápido. */
const TOPE = 300;
const DIA = 24 * 60 * 60 * 1000;
const esDia = (v?: string): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Un día "YYYY-MM-DD" del local, como instante: la medianoche de Buenos
 *  Aires, que no tiene horario de verano y es siempre UTC-3. */
const inicioDelDia = (dia: string) => new Date(`${dia}T00:00:00-03:00`);

export default async function CobrosPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; estado?: string; q?: string }>;
}) {
  await requireFacturacion();
  const params = await searchParams;

  const hoy = hoyEnArgentina();
  const hasta = esDia(params.hasta) ? params.hasta : hoy;
  const desde = esDia(params.desde)
    ? params.desde
    : new Date(inicioDelDia(hoy).getTime() - 30 * DIA + 3 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
  const filtro: Filtro = esFiltro(params.estado) ? params.estado : "sin_facturar";
  const busqueda = params.q?.trim() ?? "";

  const [cuenta] = await db
    .select({ id: cuentasMp.id })
    .from(cuentasMp)
    .where(eq(cuentasMp.isActive, true))
    .limit(1);

  const patron = `%${busqueda}%`;
  const movimientos = await db
    .select()
    .from(movimientosMp)
    .where(
      and(
        gte(movimientosMp.fechaAprobacion, inicioDelDia(desde)),
        lt(movimientosMp.fechaAprobacion, new Date(inicioDelDia(hasta).getTime() + DIA)),
        busqueda
          ? or(
              ilike(movimientosMp.titular, patron),
              ilike(movimientosMp.email, patron),
              ilike(movimientosMp.mpPagoId, patron),
            )
          : undefined,
      ),
    )
    .orderBy(desc(movimientosMp.fechaAprobacion))
    .limit(TOPE);

  // Todos los comprobantes de estos cobros en una consulta, no una por fila.
  const ids = movimientos.map((m) => m.id);
  const comps = ids.length
    ? await db
        .select({
          id: comprobantes.id,
          movimientoId: comprobantes.movimientoId,
          origenId: comprobantes.origenId,
          tipo: comprobantes.tipo,
          letra: comprobantes.letra,
          estado: comprobantes.estado,
          numeroCompleto: comprobantes.numeroCompleto,
          pdfUrl: comprobantes.pdfUrl,
          errorMensaje: comprobantes.errorMensaje,
          createdAt: comprobantes.createdAt,
        })
        .from(comprobantes)
        .where(inArray(comprobantes.movimientoId, ids))
    : [];

  const porMovimiento = new Map<string, ComprobanteResumen[]>();
  const ncPorFactura = new Map<string, ComprobanteResumen>();
  for (const c of comps) {
    if (c.tipo === "nota_credito" && c.origenId) {
      const previa = ncPorFactura.get(c.origenId);
      if (!previa || previa.createdAt < c.createdAt) ncPorFactura.set(c.origenId, c);
    }
    // Siempre tiene: la consulta filtra por cobro. Las manuales no entran acá.
    const mov = c.movimientoId;
    if (mov) porMovimiento.set(mov, [...(porMovimiento.get(mov) ?? []), c]);
  }

  const todas = movimientos.map((m) => ({
    ...m,
    situacion: situacionDe(porMovimiento.get(m.id) ?? [], ncPorFactura),
  }));
  const filas = filtro === "todos" ? todas : todas.filter((f) => f.situacion.estado === filtro);
  const total = (estado?: EstadoFacturacion) =>
    todas
      .filter((f) => !estado || f.situacion.estado === estado)
      .reduce((s, f) => s + f.montoCentavos, 0);

  const enlace = (f: Filtro) => {
    const qs = new URLSearchParams({ desde, hasta });
    if (busqueda) qs.set("q", busqueda);
    if (f !== "sin_facturar") qs.set("estado", f);
    return `/admin/facturacion/cobros?${qs}`;
  };

  return (
    <>
      <AutoRefresh activo={todas.some((f) => f.situacion.estado === "en_proceso")} />
      <Link href="/admin/facturacion" className={styles.backLink}>
        ← Facturación
      </Link>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>Cobros de Mercado Pago</h1>
          <p className={styles.pageSub}>
            Lo que entró por Mercado Pago, para facturarlo uno por uno.
          </p>
        </div>
        <div className={styles.btnRow}>
          <Link
            href="/admin/facturacion/cuenta-mp"
            className={`${styles.btn} ${styles.btnSmall}`}
          >
            Cuenta de MP
          </Link>
        </div>
      </div>

      {!cuenta ? (
        <section className={styles.card}>
          <p className={styles.hint}>
            Todavía no hay una cuenta de Mercado Pago vinculada.{" "}
            <Link href="/admin/facturacion/cuenta-mp">Vincularla</Link>.
          </p>
        </section>
      ) : (
        <>
          <section className={styles.card} style={{ marginBottom: 18 }}>
            <SyncForm />
          </section>

          <form className={propios.periodo}>
            <label className={propios.syncCampo}>
              <span className={styles.label}>Desde</span>
              <input type="date" name="desde" defaultValue={desde} className={styles.input} />
            </label>
            <label className={propios.syncCampo}>
              <span className={styles.label}>Hasta</span>
              <input type="date" name="hasta" defaultValue={hasta} className={styles.input} />
            </label>
            <label className={propios.syncCampo}>
              <span className={styles.label}>Buscar</span>
              <input
                type="search"
                name="q"
                defaultValue={busqueda}
                placeholder="Titular, email o n° de operación"
                className={styles.input}
              />
            </label>
            {filtro !== "sin_facturar" ? (
              <input type="hidden" name="estado" value={filtro} />
            ) : null}
            <button type="submit" className={`${styles.btn} ${styles.btnSmall}`}>
              Ver
            </button>
          </form>

          <div className={propios.filtros}>
            {(Object.keys(FILTROS) as Filtro[]).map((f) => (
              <Link
                key={f}
                href={enlace(f)}
                className={`${propios.filtro} ${f === filtro ? propios.filtroActivo : ""}`}
              >
                {FILTROS[f]}
              </Link>
            ))}
          </div>

          <p className={propios.totales}>
            <span>
              Cobrado en el período <strong>{formatARS(total())}</strong>
            </span>
            <span>
              Facturado <strong>{formatARS(total("facturado"))}</strong>
            </span>
            <span>
              Sin facturar <strong>{formatARS(total("sin_facturar"))}</strong>
            </span>
          </p>

          <section className={`${styles.card} ${styles.cardTight}`}>
            {filas.length === 0 ? (
              <p className={styles.empty}>
                {movimientos.length === 0
                  ? "No hay cobros en este período. Probá con “Actualizar”."
                  : "Ningún cobro del período está en este estado."}
              </p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Fecha</th>
                      <th scope="col">Quién pagó</th>
                      <th scope="col">Medio</th>
                      <th scope="col" className={propios.importe}>
                        Cobrado
                      </th>
                      <th scope="col" className={propios.importe}>
                        Neto
                      </th>
                      <th scope="col">Factura</th>
                      <th scope="col" aria-label="Acciones" />
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((m) => (
                      <tr key={m.id}>
                        <td>{formatDateTime(m.fechaAprobacion)}</td>
                        <td data-label="Quién pagó">
                          <span className={styles.cellName}>{m.titular ?? "—"}</span>
                          <span className={styles.cellDim}>
                            {m.email ?? m.descripcion ?? `Operación ${m.mpPagoId}`}
                          </span>
                        </td>
                        <td data-label="Medio" className={styles.cellDim}>{m.metodoPago ?? "—"}</td>
                        <td data-label="Cobrado" className={propios.importe}>{formatARS(m.montoCentavos)}</td>
                        <td data-label="Neto" className={`${propios.importe} ${styles.cellDim}`}>
                          {m.netoCentavos != null ? formatARS(m.netoCentavos) : "—"}
                        </td>
                        <td data-label="Factura">
                          <EstadoCelda situacion={m.situacion} />
                        </td>
                        <td>
                          <Link
                            href={`/admin/facturacion/${m.id}`}
                            className={`${styles.btn} ${styles.btnSmall}`}
                          >
                            {sePuedeFacturar(m.situacion) ? "Facturar" : "Ver"}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          {movimientos.length === TOPE ? (
            <p className={styles.hint}>
              Se muestran los {TOPE} cobros más recientes del período. Achicá las
              fechas para ver el resto.
            </p>
          ) : null}
        </>
      )}
    </>
  );
}

function EstadoCelda({ situacion }: { situacion: ReturnType<typeof situacionDe> }) {
  const { estado, factura, notaCredito } = situacion;
  if (estado === "sin_facturar" && !factura) {
    return <span className={styles.cellDim}>Sin facturar</span>;
  }
  return (
    <span className={propios.estado}>
      {factura?.numeroCompleto ? (
        factura.pdfUrl ? (
          <a href={factura.pdfUrl} target="_blank" rel="noreferrer" className={propios.numero}>
            {factura.numeroCompleto}
          </a>
        ) : (
          <span className={propios.numero}>{factura.numeroCompleto}</span>
        )
      ) : null}
      <span className={styles.cellDim}>
        {
          {
            sin_facturar: "Anulada con nota de crédito",
            en_proceso: notaCredito ? "Anulando…" : "Emitiendo…",
            facturado: `Factura ${factura?.letra}`,
            con_error: "No se pudo emitir",
          }[estado]
        }
      </span>
      {estado === "con_error" && factura?.errorMensaje ? (
        <span className={propios.error}>{factura.errorMensaje}</span>
      ) : null}
    </span>
  );
}
