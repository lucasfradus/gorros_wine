import Link from "next/link";
import { and, asc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { clientes } from "@/lib/db/schema";
import { canManageCuentaCorriente, requireUser } from "@/lib/auth";
import { SALDO_CERO, tieneDeuda, type Saldo } from "@/lib/cuenta-corriente";
import { saldosPorCliente } from "@/lib/db/cuenta";
import { formatARS, formatUSD } from "@/lib/format";
import styles from "../../admin.module.css";
import propios from "./clientes.module.css";

export const metadata = { title: "Clientes" };

const FILTROS = {
  activos: "Activos",
  cc: "Cuenta corriente",
  deuda: "Con deuda",
  archivados: "Archivados",
} as const;

type Filtro = keyof typeof FILTROS;

function esFiltro(v: string | undefined): v is Filtro {
  return v !== undefined && v in FILTROS;
}

/** Un importe del listado: en cero no se dibuja, para que la deuda resalte. */
function Importe({
  centavos,
  formato,
}: {
  centavos: number;
  formato: (c: number) => string;
}) {
  if (centavos === 0) return <span className={styles.cellDim}>—</span>;
  return (
    <span className={centavos < 0 ? propios.negativo : propios.positivo}>
      {formato(Math.abs(centavos))}
      <span className={styles.cellDim}>{centavos < 0 ? " debe" : " a favor"}</span>
    </span>
  );
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filtro?: string }>;
}) {
  const actor = await requireUser();

  const { q, filtro: filtroCrudo } = await searchParams;
  const puedeVerPlata = canManageCuentaCorriente(actor);

  // El filtro por deuda no tiene sentido para quien no ve saldos.
  const pedido = esFiltro(filtroCrudo) ? filtroCrudo : "activos";
  const filtro: Filtro = pedido === "deuda" && !puedeVerPlata ? "activos" : pedido;

  const busqueda = q?.trim() ?? "";
  const patron = `%${busqueda}%`;

  const condiciones = [
    eq(clientes.isActive, filtro !== "archivados"),
    filtro === "cc" ? eq(clientes.cuentaCorriente, true) : undefined,
    busqueda
      ? or(
          ilike(clientes.nombre, patron),
          ilike(clientes.apodo, patron),
          ilike(clientes.telefono, patron),
          ilike(clientes.documento, patron),
        )
      : undefined,
  ].filter((c) => c !== undefined);

  const lista = await db
    .select({
      id: clientes.id,
      nombre: clientes.nombre,
      apodo: clientes.apodo,
      telefono: clientes.telefono,
      cuentaCorriente: clientes.cuentaCorriente,
      isActive: clientes.isActive,
    })
    .from(clientes)
    .where(and(...condiciones))
    .orderBy(asc(clientes.nombre));

  // Una sola consulta agregada para todos los saldos, no una por fila.
  const saldos = puedeVerPlata
    ? await saldosPorCliente(lista.map((c) => c.id))
    : new Map<string, Saldo>();

  // "Con deuda" se resuelve acá y no en SQL: el saldo es una suma de otra
  // tabla y filtrarlo en la consulta pediría un join que, con este volumen,
  // no compra nada.
  const filas =
    filtro === "deuda"
      ? lista.filter((c) => tieneDeuda(saldos.get(c.id) ?? SALDO_CERO))
      : lista;

  const enlaceFiltro = (f: Filtro) => {
    const params = new URLSearchParams();
    if (busqueda) params.set("q", busqueda);
    if (f !== "activos") params.set("filtro", f);
    const qs = params.toString();
    return qs ? `/admin/clientes?${qs}` : "/admin/clientes";
  };

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>Clientes</h1>
          <p className={styles.pageSub}>
            Quién le compra a la vinoteca. Son los del negocio, no las cuentas
            del panel.
          </p>
        </div>
        <Link
          href="/admin/clientes/nuevo"
          className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`}
        >
          Nuevo cliente
        </Link>
      </div>

      <form className={propios.buscador}>
        <div className={propios.buscadorCampo}>
          <label className={styles.label} htmlFor="q">
            Buscar
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={busqueda}
            placeholder="Nombre, apodo, teléfono o documento"
            className={styles.input}
          />
        </div>
        {filtro !== "activos" ? (
          <input type="hidden" name="filtro" value={filtro} />
        ) : null}
        <button type="submit" className={`${styles.btn} ${styles.btnSmall}`}>
          Buscar
        </button>
      </form>

      <div className={propios.filtros} style={{ marginBottom: 18 }}>
        {(Object.keys(FILTROS) as Filtro[])
          .filter((f) => f !== "deuda" || puedeVerPlata)
          .map((f) => (
            <Link
              key={f}
              href={enlaceFiltro(f)}
              className={`${propios.filtro} ${f === filtro ? propios.filtroActivo : ""}`}
            >
              {FILTROS[f]}
            </Link>
          ))}
      </div>

      <section className={`${styles.card} ${styles.cardTight}`}>
        {filas.length === 0 ? (
          <p className={styles.empty}>
            {busqueda
              ? `No hay clientes que coincidan con “${busqueda}”.`
              : "Todavía no hay clientes acá."}
          </p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Cliente</th>
                  <th scope="col">Contacto</th>
                  {puedeVerPlata ? (
                    <>
                      <th scope="col" className={propios.importeCelda}>
                        Pesos
                      </th>
                      <th scope="col" className={propios.importeCelda}>
                        Dólares
                      </th>
                    </>
                  ) : null}
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {filas.map((c) => {
                  const saldo = saldos.get(c.id) ?? SALDO_CERO;
                  return (
                    <tr key={c.id}>
                      <td>
                        <span className={styles.cellName}>
                          {c.nombre}
                          {c.cuentaCorriente ? (
                            <span className={styles.badge}>cta cte</span>
                          ) : null}
                          {c.isActive ? null : (
                            <span className={`${styles.badge} ${styles.badgeOff}`}>
                              archivado
                            </span>
                          )}
                        </span>
                        {c.apodo ? (
                          <span className={styles.cellMail}>{c.apodo}</span>
                        ) : null}
                      </td>
                      <td className={styles.cellDim}>{c.telefono ?? "—"}</td>
                      {puedeVerPlata ? (
                        <>
                          <td className={propios.importeCelda}>
                            <Importe
                              centavos={saldo.arsCentavos}
                              formato={formatARS}
                            />
                          </td>
                          <td className={propios.importeCelda}>
                            <Importe
                              centavos={saldo.usdCentavos}
                              formato={formatUSD}
                            />
                          </td>
                        </>
                      ) : null}
                      <td className={styles.cellRight}>
                        <Link
                          href={`/admin/clientes/${c.id}`}
                          className={`${styles.btn} ${styles.btnSmall}`}
                        >
                          Ver
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
  );
}
