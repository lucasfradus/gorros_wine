import { eq, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { clientes, movimientosCc } from "@/lib/db/schema";
import type { Saldo } from "@/lib/cuenta-corriente";

/**
 * Las consultas de la cuenta corriente. Las **reglas** están en
 * `lib/cuenta-corriente.ts`, que no toca la base a propósito.
 */

/**
 * Los saldos de varios clientes de una sola consulta, para el listado.
 *
 * Una query agregada y no una por fila: con `GROUP BY` esto es una sola ida a
 * la base tenga 5 clientes o 500. Los que no tienen ni un movimiento no vuelven
 * en el resultado; el llamador los toma como cero.
 *
 * No filtra las operaciones anuladas, y está bien así: anular agrega la fila
 * inversa, con lo cual la suma ya da lo que tiene que dar.
 *
 * `sum()` sobre un `bigint` vuelve como string —Postgres no arriesga precisión
 * al serializar— y se pasa a número acá: un saldo en centavos entra holgado en
 * los enteros seguros de JavaScript.
 */
export async function saldosPorCliente(
  clienteIds: string[],
): Promise<Map<string, Saldo>> {
  const saldos = new Map<string, Saldo>();
  if (clienteIds.length === 0) return saldos;

  const filas = await db
    .select({
      clienteId: movimientosCc.clienteId,
      ars: sql<string>`coalesce(sum(${movimientosCc.deltaArsCentavos}), 0)`,
      usd: sql<string>`coalesce(sum(${movimientosCc.deltaUsdCentavos}), 0)`,
    })
    .from(movimientosCc)
    .where(inArray(movimientosCc.clienteId, clienteIds))
    .groupBy(movimientosCc.clienteId);

  for (const f of filas) {
    saldos.set(f.clienteId, {
      arsCentavos: Number(f.ars),
      usdCentavos: Number(f.usd),
    });
  }
  return saldos;
}

/**
 * Cuántos clientes activos deben algo, en cualquiera de las dos monedas.
 *
 * Es el número que se mira al entrar al panel: a cuántos hay que ir a buscar.
 * Los archivados no cuentan aunque tengan deuda — su saldo sigue guardado, pero
 * ya no están en la lista de nadie.
 *
 * El `HAVING` deja el filtro en Postgres en vez de traerse todos los saldos
 * para contarlos acá.
 */
export async function contarClientesConDeuda(): Promise<number> {
  const conDeuda = await db
    .select({ clienteId: movimientosCc.clienteId })
    .from(movimientosCc)
    .innerJoin(clientes, eq(clientes.id, movimientosCc.clienteId))
    .where(eq(clientes.isActive, true))
    .groupBy(movimientosCc.clienteId)
    .having(
      or(
        lt(sql`sum(${movimientosCc.deltaArsCentavos})`, 0),
        lt(sql`sum(${movimientosCc.deltaUsdCentavos})`, 0),
      ),
    );

  return conDeuda.length;
}
