import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { cuentasMp, movimientosMp } from "@/lib/db/schema";
import { tokenDe } from "./cuenta";
import {
  construirUrlBusqueda,
  mapearPago,
  respuestaBusquedaSchema,
  type PagoMapeado,
} from "./pagos-map";

/**
 * Trae los cobros aprobados de Mercado Pago y los copia a `movimientos_mp`.
 *
 * Sólo `status=approved`: es lo único facturable, y mezclar pendientes y
 * rechazados convierte la pantalla en ruido.
 */

const LIMIT = 50;
/** Tope de páginas por cuenta: red contra un `paging.total` mal informado. */
const MAX_PAGINAS = 40;

export const DIAS_VENTANA_DEFAULT = 7;

/**
 * Pagina el buscador de MP hasta agotar los resultados. Corta por el total que
 * informa MP **y** ante una página vacía: confiar sólo en el total deja el
 * barrido colgado si viene mal.
 */
async function buscarPagosAprobados(
  token: string,
  desde: Date,
  hasta: Date,
): Promise<PagoMapeado[]> {
  const out: PagoMapeado[] = [];
  let offset = 0;

  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const res = await fetch(construirUrlBusqueda(desde, hasta, offset, LIMIT), {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`MP payments/search HTTP ${res.status}`);

    const parsed = respuestaBusquedaSchema.safeParse(await res.json());
    if (!parsed.success) throw new Error("MP payments/search: respuesta inesperada");

    const results = parsed.data.results ?? [];
    if (results.length === 0) break;

    for (const raw of results) {
      const m = mapearPago(raw);
      if (m) out.push(m);
    }

    offset += results.length;
    const total = parsed.data.paging?.total;
    if (typeof total === "number" && offset >= total) break;
  }

  return out;
}

export interface ResultadoSync {
  cuentas: number;
  nuevos: number;
  actualizados: number;
  /** Cuentas que no se pudieron barrer. No frenan al resto. */
  fallidas: { alias: string; error: string }[];
}

export async function sincronizarPagos(
  opts: { desde?: Date; hasta?: Date } = {},
): Promise<ResultadoSync> {
  const hasta = opts.hasta ?? new Date();
  const desde =
    opts.desde ??
    new Date(hasta.getTime() - DIAS_VENTANA_DEFAULT * 24 * 60 * 60 * 1000);

  const cuentas = await db
    .select()
    .from(cuentasMp)
    .where(eq(cuentasMp.isActive, true));

  const resultado: ResultadoSync = {
    cuentas: cuentas.length,
    nuevos: 0,
    actualizados: 0,
    fallidas: [],
  };

  for (const cuenta of cuentas) {
    let pagos: PagoMapeado[];
    try {
      pagos = await buscarPagosAprobados(tokenDe(cuenta), desde, hasta);
    } catch (e) {
      resultado.fallidas.push({
        alias: cuenta.alias,
        error: e instanceof Error ? e.message : String(e),
      });
      continue;
    }

    for (const p of pagos) {
      const datos = { cuentaId: cuenta.id, ...p, updatedAt: new Date() };
      // `xmax = 0` distingue en Postgres un INSERT de un UPDATE dentro del
      // mismo upsert: es la forma de contar nuevos sin una consulta previa.
      const [fila] = await db
        .insert(movimientosMp)
        .values(datos)
        .onConflictDoUpdate({ target: movimientosMp.mpPagoId, set: datos })
        .returning({ nuevo: sql<boolean>`(xmax = 0)` });
      if (fila?.nuevo) resultado.nuevos++;
      else resultado.actualizados++;
    }
  }

  return resultado;
}
