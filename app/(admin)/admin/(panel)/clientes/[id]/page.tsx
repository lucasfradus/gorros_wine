import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { clientes, movimientosCc } from "@/lib/db/schema";
import { canManageCuentaCorriente, requireUser } from "@/lib/auth";
import {
  conOperacionesJuntas,
  excedidoDelLimite,
  gruposAnulados,
  saldoDe,
} from "@/lib/cuenta-corriente";
import {
  formatARS,
  formatCotizacion,
  formatDate,
  formatDateTime,
  formatUSD,
  hoyEnArgentina,
  importeEditable,
} from "@/lib/format";
import { actualizarClienteAction, archivarClienteAction } from "../actions";
import {
  anularOperacionAction,
  registrarMovimientoAction,
} from "../cuenta-actions";
import { ArchivarForm, ClienteForm } from "../cliente-forms";
import { AnularForm, MovimientoForm } from "../cuenta-forms";
import styles from "../../../admin.module.css";
import propios from "../clientes.module.css";

export const metadata = { title: "Cliente" };

const ETIQUETA_TIPO: Record<string, string> = {
  saldo_inicial: "Saldo inicial",
  cargo: "Cargo",
  pago: "Pago",
  conversion: "Conversión",
  ajuste: "Ajuste",
};

/** Una celda de importe del extracto. El cero no se dibuja. */
function Delta({
  centavos,
  formato,
}: {
  centavos: number;
  formato: (c: number) => string;
}) {
  if (centavos === 0) return <span className={styles.cellDim}>—</span>;
  return (
    <span className={centavos < 0 ? propios.negativo : propios.positivo}>
      {formato(centavos)}
    </span>
  );
}

function TarjetaSaldo({
  moneda,
  centavos,
  excedido,
  formato,
}: {
  moneda: string;
  centavos: number;
  excedido: number;
  formato: (c: number) => string;
}) {
  const estado =
    centavos < 0
      ? propios.saldoDeuda
      : centavos > 0
        ? propios.saldoFavor
        : "";

  return (
    <div className={propios.saldo}>
      <span className={propios.saldoMoneda}>{moneda}</span>
      <span className={`${propios.saldoImporte} ${estado}`}>
        {formato(Math.abs(centavos))}
      </span>
      <span className={propios.saldoNota}>
        {centavos < 0
          ? "te debe"
          : centavos > 0
            ? "tiene a favor"
            : "sin saldo"}
      </span>
      {excedido > 0 ? (
        <span className={propios.excedido}>
          Se pasó del límite por {formato(excedido)}
        </span>
      ) : null}
    </div>
  );
}

export default async function ClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await requireUser();

  // Sin esto, un id que no es UUID llega a Postgres y revienta la consulta en
  // vez de dar un 404 limpio.
  if (!z.uuid().safeParse(id).success) notFound();

  const [cliente] = await db
    .select()
    .from(clientes)
    .where(eq(clientes.id, id))
    .limit(1);

  if (!cliente) notFound();

  const puedeVerPlata = canManageCuentaCorriente(actor);

  // El extracto se trae entero: es la fuente del saldo y del tachado de las
  // anulaciones, y con el volumen de un cliente no hay nada que paginar.
  const movimientos = puedeVerPlata
    ? await db
        .select()
        .from(movimientosCc)
        .where(eq(movimientosCc.clienteId, cliente.id))
        .orderBy(desc(movimientosCc.fecha), desc(movimientosCc.createdAt))
    : [];

  const saldo = saldoDe(movimientos);
  const anulados = gruposAnulados(movimientos);
  const excedido = excedidoDelLimite(cliente, saldo);

  // El saldo se calcula sobre lo que vino de la base; el extracto se dibuja
  // sobre esto, que garantiza que las patas de una operación queden juntas.
  const extracto = conOperacionesJuntas(movimientos);

  return (
    <>
      <Link href="/admin/clientes" className={styles.backLink}>
        ← Clientes
      </Link>

      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>
            {cliente.nombre}
            {cliente.cuentaCorriente ? (
              <span className={styles.badge}>cta cte</span>
            ) : null}
            {cliente.isActive ? null : (
              <span className={`${styles.badge} ${styles.badgeOff}`}>
                archivado
              </span>
            )}
          </h1>
          <p className={styles.pageSub}>
            {[cliente.apodo, cliente.telefono, cliente.email]
              .filter(Boolean)
              .join(" · ") || "Sin datos de contacto cargados."}
          </p>
        </div>
      </div>

      <div className={styles.stack}>
        {puedeVerPlata ? (
          <div className={propios.saldos}>
            <TarjetaSaldo
              moneda="Pesos"
              centavos={saldo.arsCentavos}
              excedido={excedido.arsCentavos}
              formato={formatARS}
            />
            <TarjetaSaldo
              moneda="Dólares"
              centavos={saldo.usdCentavos}
              excedido={excedido.usdCentavos}
              formato={formatUSD}
            />
          </div>
        ) : null}

        {puedeVerPlata ? (
          <section className={styles.card}>
            <h2 className={`${styles.label} ${styles.sectionHead}`}>
              Cuenta corriente
            </h2>

            {movimientos.length === 0 ? (
              <p className={styles.empty}>
                La cuenta está vacía. Cargá un cargo o un pago para empezar.
              </p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Fecha</th>
                      <th scope="col">Detalle</th>
                      <th scope="col" className={propios.importeCelda}>
                        Pesos
                      </th>
                      <th scope="col" className={propios.importeCelda}>
                        Dólares
                      </th>
                      <th scope="col" className={propios.importeCelda}>
                        TC
                      </th>
                      <th scope="col" />
                    </tr>
                  </thead>
                  <tbody>
                    {extracto.map((m, i) => {
                      const anulado = anulados.has(m.grupoId);
                      const sigueAlAnterior =
                        i > 0 && extracto[i - 1].grupoId === m.grupoId;

                      return (
                        <tr
                          key={m.id}
                          className={sigueAlAnterior ? propios.mismaOperacion : ""}
                        >
                          <td className={styles.cellDim}>
                            {sigueAlAnterior ? "" : formatDate(m.fecha)}
                          </td>
                          <td className={anulado ? propios.anulado : ""}>
                            <span className={propios.detalleTipo}>
                              {ETIQUETA_TIPO[m.tipo] ?? m.tipo}
                            </span>
                            {m.detalle}
                            {anulado ? (
                              <span className={propios.anuladoTag}>anulado</span>
                            ) : null}
                          </td>
                          <td
                            className={`${propios.importeCelda} ${anulado ? propios.anulado : ""}`}
                          >
                            <Delta
                              centavos={m.deltaArsCentavos}
                              formato={formatARS}
                            />
                          </td>
                          <td
                            className={`${propios.importeCelda} ${anulado ? propios.anulado : ""}`}
                          >
                            <Delta
                              centavos={m.deltaUsdCentavos}
                              formato={formatUSD}
                            />
                          </td>
                          <td className={`${propios.importeCelda} ${propios.cotiz}`}>
                            {formatCotizacion(m.cotizacion)}
                          </td>
                          <td className={styles.cellRight}>
                            {/* Una vez por operación, y nunca sobre una
                                anulación: revertir la reversión volvería a
                                aplicar el movimiento por la puerta de atrás. */}
                            {sigueAlAnterior || anulado || m.anulaGrupoId ? null : (
                              <AnularForm
                                action={anularOperacionAction}
                                grupoId={m.grupoId}
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}

        {puedeVerPlata ? (
          <section className={styles.card}>
            <h2 className={`${styles.label} ${styles.sectionHead}`}>
              Nuevo movimiento
            </h2>
            <MovimientoForm
              action={registrarMovimientoAction}
              clienteId={cliente.id}
              hoy={hoyEnArgentina()}
            />
          </section>
        ) : null}

        <section className={styles.card}>
          <h2 className={`${styles.label} ${styles.sectionHead}`}>Datos</h2>
          <ClienteForm
            action={actualizarClienteAction}
            submitLabel="Guardar cambios"
            puedeVerPlata={puedeVerPlata}
            defaults={{
              id: cliente.id,
              nombre: cliente.nombre,
              apodo: cliente.apodo,
              telefono: cliente.telefono,
              email: cliente.email,
              documento: cliente.documento,
              razonSocial: cliente.razonSocial,
              direccion: cliente.direccion,
              notas: cliente.notas,
              cuentaCorriente: cliente.cuentaCorriente,
              limiteArs: importeEditable(cliente.limiteArsCentavos),
              limiteUsd: importeEditable(cliente.limiteUsdCentavos),
            }}
          />
        </section>

        <section className={styles.card}>
          <h2 className={`${styles.label} ${styles.sectionHead}`}>Archivo</h2>
          <ArchivarForm
            action={archivarClienteAction}
            clienteId={cliente.id}
            isActive={cliente.isActive}
          />
        </section>

        <section className={styles.card}>
          <h2 className={`${styles.label} ${styles.sectionHead}`}>Ficha</h2>
          <ul className={styles.metaList}>
            <li>
              <span className={styles.metaLabel}>Documento</span>
              {cliente.documento ?? "—"}
            </li>
            <li>
              <span className={styles.metaLabel}>Razón social</span>
              {cliente.razonSocial ?? "—"}
            </li>
            <li>
              <span className={styles.metaLabel}>Dirección</span>
              {cliente.direccion ?? "—"}
            </li>
            <li>
              <span className={styles.metaLabel}>Alta</span>
              {formatDateTime(cliente.createdAt)}
            </li>
          </ul>
        </section>
      </div>
    </>
  );
}
