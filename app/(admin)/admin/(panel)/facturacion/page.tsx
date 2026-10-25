import Link from "next/link";
import { and, desc, eq, gte, ilike, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { comprobantes, comprobanteEstado } from "@/lib/db/schema";
import { requireFacturacion } from "@/lib/auth";
import { formatARS, hoyEnArgentina } from "@/lib/format";
import { AutoRefresh } from "./auto-refresh";
import { ListaComprobantes } from "./lista-comprobantes";
import { ESTADOS } from "./tabla-comprobantes";
import styles from "../../admin.module.css";
import propios from "./facturacion.module.css";

export const metadata = { title: "Facturación" };

/** Tope de filas: con un período razonable no se llega, y si se llega, la
 *  página sigue respondiendo rápido. */
const TOPE = 300;
const DIA = 24 * 60 * 60 * 1000;
// Con formato y además fecha real: "2026-13-45" daría Invalid Date y la
// consulta reventaría.
const esDia = (v?: string): v is string =>
  !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
/** Medianoche de Buenos Aires (UTC-3 todo el año). */
const inicioDelDia = (dia: string) => new Date(`${dia}T00:00:00-03:00`);

const TIPOS = { factura: "Facturas", nota_credito: "Notas de crédito" } as const;
const ORIGENES = { manual: "Manuales", mp: "De Mercado Pago" } as const;
const elegido = <T extends string>(opciones: Record<T, string>, v?: string) =>
  v !== undefined && v in opciones ? (v as T) : undefined;

/**
 * El inicio de Facturación: todo lo emitido, manual o de un cobro de MP. Es lo
 * que se mira todos los días; los cobros de MP por facturar están en
 * `/cobros`.
 */
export default async function FacturacionPage({
  searchParams,
}: {
  searchParams: Promise<{
    desde?: string;
    hasta?: string;
    q?: string;
    tipo?: string;
    letra?: string;
    estado?: string;
    origen?: string;
  }>;
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
  const busqueda = params.q?.trim() ?? "";
  const tipo = elegido(TIPOS, params.tipo);
  const origen = elegido(ORIGENES, params.origen);
  const letra = params.letra === "A" || params.letra === "B" ? params.letra : undefined;
  const estado = comprobanteEstado.enumValues.find((e) => e === params.estado);

  // % y _ son comodines de LIKE: tipeados, se buscan tal cual.
  const patron = `%${busqueda.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  // El documento se guarda en dígitos: "20-1234" busca "201234".
  const digitos = busqueda.replace(/\D/g, "");
  const filtro = and(
    // Por la fecha fiscal, la impresa: una factura fechada ayer es de ayer
    // aunque se haya cargado hoy.
    gte(comprobantes.fecha, desde),
    lte(comprobantes.fecha, hasta),
    busqueda
      ? or(
          ilike(comprobantes.receptorNombre, patron),
          ilike(comprobantes.numeroCompleto, patron),
          digitos.length >= 3 ? ilike(comprobantes.receptorDocNumero, `%${digitos}%`) : undefined,
        )
      : undefined,
    tipo ? eq(comprobantes.tipo, tipo) : undefined,
    letra ? eq(comprobantes.letra, letra) : undefined,
    estado ? eq(comprobantes.estado, estado) : undefined,
    origen === "manual" ? isNull(comprobantes.movimientoId) : undefined,
    origen === "mp" ? isNotNull(comprobantes.movimientoId) : undefined,
  );

  // Los totales van en SQL sobre todo el período, no sobre las filas que se
  // muestran: pasado el TOPE darían de menos. Una factura anulada se emitió
  // igual: cuenta en lo facturado, y su NC la descuenta.
  const [filas, [totales]] = await Promise.all([
    db
      .select()
      .from(comprobantes)
      .where(filtro)
      .orderBy(desc(comprobantes.fecha), desc(comprobantes.createdAt))
      .limit(TOPE),
    db
      .select({
        facturado: sql<number>`coalesce(sum(${comprobantes.totalCentavos}) filter (where ${comprobantes.tipo} = 'factura' and ${comprobantes.estado} in ('autorizado', 'anulado')), 0)`.mapWith(Number),
        acreditado: sql<number>`coalesce(sum(${comprobantes.totalCentavos}) filter (where ${comprobantes.tipo} = 'nota_credito' and ${comprobantes.estado} = 'autorizado'), 0)`.mapWith(Number),
        conProblema: sql<number>`count(*) filter (where ${comprobantes.estado} = 'error')`.mapWith(Number),
      })
      .from(comprobantes)
      .where(filtro),
  ]);
  const { facturado, acreditado, conProblema } = totales;
  const filtrando = !!(busqueda || tipo || letra || estado || origen);

  return (
    <div className={styles.anchoCompleto}>
      <AutoRefresh activo={filas.some((c) => c.estado === "pendiente" || c.estado === "en_proceso")} />
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>Facturación</h1>
          <p className={styles.pageSub}>Todo lo emitido: facturas y notas de crédito.</p>
        </div>
        <div className={styles.btnRow}>
          <Link
            href="/admin/facturacion/manual"
            className={`${styles.btn} ${styles.btnSmall} ${styles.btnPrimary}`}
          >
            Nueva factura
          </Link>
          <Link href="/admin/facturacion/cobros" className={`${styles.btn} ${styles.btnSmall}`}>
            Cobros de MP
          </Link>
          <Link href="/admin/facturacion/cuenta-mp" className={`${styles.btn} ${styles.btnSmall}`}>
            Cuenta de MP
          </Link>
        </div>
      </div>

      <form className={propios.periodo}>
        <label className={propios.syncCampo}>
          <span className={styles.label}>Desde</span>
          <input type="date" name="desde" defaultValue={desde} className={styles.input} />
        </label>
        <label className={propios.syncCampo}>
          <span className={styles.label}>Hasta</span>
          <input type="date" name="hasta" defaultValue={hasta} className={styles.input} />
        </label>
        <label className={`${propios.syncCampo} ${propios.campoAncho}`}>
          <span className={styles.label}>Buscar</span>
          <input
            type="search"
            name="q"
            defaultValue={busqueda}
            placeholder="Nombre, CUIT/DNI o número"
            className={styles.input}
          />
        </label>
        <label className={propios.syncCampo}>
          <span className={styles.label}>Tipo</span>
          <select name="tipo" defaultValue={tipo ?? ""} className={styles.select}>
            <option value="">Todos</option>
            {(Object.keys(TIPOS) as (keyof typeof TIPOS)[]).map((t) => (
              <option key={t} value={t}>
                {TIPOS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className={propios.syncCampo}>
          <span className={styles.label}>Letra</span>
          <select name="letra" defaultValue={letra ?? ""} className={styles.select}>
            <option value="">Todas</option>
            <option value="A">A</option>
            <option value="B">B</option>
          </select>
        </label>
        <label className={propios.syncCampo}>
          <span className={styles.label}>Estado</span>
          <select name="estado" defaultValue={estado ?? ""} className={styles.select}>
            <option value="">Todos</option>
            {comprobanteEstado.enumValues.map((e) => (
              <option key={e} value={e}>
                {ESTADOS[e]}
              </option>
            ))}
          </select>
        </label>
        <label className={propios.syncCampo}>
          <span className={styles.label}>Origen</span>
          <select name="origen" defaultValue={origen ?? ""} className={styles.select}>
            <option value="">Todos</option>
            {(Object.keys(ORIGENES) as (keyof typeof ORIGENES)[]).map((o) => (
              <option key={o} value={o}>
                {ORIGENES[o]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={`${styles.btn} ${styles.btnSmall}`}>
          Ver
        </button>
        {filtrando ? (
          <Link
            href={`/admin/facturacion?${new URLSearchParams({ desde, hasta })}`}
            className={`${styles.btn} ${styles.btnSmall}`}
          >
            Limpiar
          </Link>
        ) : null}
      </form>

      <p className={propios.totales}>
        <span>
          Facturado <strong>{formatARS(facturado)}</strong>
        </span>
        <span>
          Notas de crédito <strong>{formatARS(-acreditado)}</strong>
        </span>
        <span>
          Neto <strong>{formatARS(facturado - acreditado)}</strong>
        </span>
        {conProblema > 0 && estado !== "error" ? (
          <Link
            href={`/admin/facturacion?${new URLSearchParams({ desde, hasta, estado: "error" })}`}
            className={propios.error}
          >
            {conProblema === 1 ? "1 no se emitió" : `${conProblema} no se emitieron`}
          </Link>
        ) : null}
      </p>

      <section className={`${styles.card} ${styles.cardTight}`}>
        {filas.length === 0 ? (
          <p className={styles.empty}>
            {filtrando
              ? "Nada coincide con esa búsqueda en el período."
              : "No se emitió nada en este período."}
          </p>
        ) : (
          <ListaComprobantes comps={filas} />
        )}
      </section>
      {filas.length === TOPE ? (
        <p className={styles.hint}>
          Se muestran los {TOPE} más recientes. Achicá las fechas para ver el resto.
        </p>
      ) : null}
    </div>
  );
}
