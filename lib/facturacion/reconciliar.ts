import { and, eq, isNotNull, isNull, lt, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { comprobantes } from "@/lib/db/schema";
import { configFacturante } from "@/lib/facturante/config";
import { consultarEnFacturante } from "@/lib/facturante/client";
import { parseDocumento } from "@/lib/facturante/mappers";
import { guardarDocumento } from "./guardar";
import { ESPERA_ENVIO_MS, ESPERA_PENDIENTE_MS } from "./estado";

/**
 * Resolver comprobantes que quedaron a mitad de camino.
 *
 * Con `facturanteId` se le pregunta a Facturante. Sin él no hay forma por API:
 * la búsqueda no encuentra por externalId (probado), así que sólo queda que
 * una persona mire el panel de Facturante y lo marque a mano.
 */


export async function consultarEstado(
  comprobanteId: string,
): Promise<{ ok: true; estado: string } | { ok: false; error: string }> {
  const cfg = configFacturante();
  if (!cfg) return { ok: false, error: "Falta la configuración de Facturante." };

  const [c] = await db
    .select({ facturanteId: comprobantes.facturanteId })
    .from(comprobantes)
    .where(eq(comprobantes.id, comprobanteId))
    .limit(1);
  if (!c) return { ok: false, error: "No se encontró el comprobante." };
  if (!c.facturanteId) {
    return {
      ok: false,
      error: "Facturante nunca devolvió su número interno: hay que buscarlo en su panel.",
    };
  }

  try {
    const doc = await consultarEnFacturante(cfg, Number(c.facturanteId));
    const r = parseDocumento(doc);
    await guardarDocumento(comprobanteId, r, doc);
    return { ok: true, estado: r.estado };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Facturante no respondió." };
  }
}

/**
 * Para el cron: consulta los en proceso que tienen `facturanteId`, y da por
 * no enviados los `pendiente` viejos (el POST se marca en proceso antes de
 * salir, así que un pendiente de hace rato es un `after()` que nunca corrió).
 */
export async function reconciliarPendientes(): Promise<{ consultados: number; liberados: number }> {
  const enProceso = await db
    .select({ id: comprobantes.id })
    .from(comprobantes)
    .where(and(eq(comprobantes.estado, "en_proceso"), isNotNull(comprobantes.facturanteId)));

  for (const c of enProceso) {
    const r = await consultarEstado(c.id);
    if (!r.ok) console.warn(`[facturacion] reconciliar ${c.id}: ${r.error}`);
  }

  const liberados = await db
    .update(comprobantes)
    .set({
      estado: "error",
      errorMensaje: "No se llegó a enviar a Facturante.",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(comprobantes.estado, "pendiente"),
        isNull(comprobantes.enviadoEn),
        lt(comprobantes.createdAt, new Date(Date.now() - ESPERA_PENDIENTE_MS)),
      ),
    )
    .returning({ id: comprobantes.id });

  return { consultados: enProceso.length, liberados: liberados.length };
}

/**
 * "Revisé Facturante y no está": libera el cobro para volver a facturarlo.
 *
 * Sólo para los que nunca devolvieron `facturanteId` (con él, se consulta) y
 * después de la espera del webhook: antes, lo más probable es que siga en
 * camino. Queda en `error` con quién lo marcó, para que se vea en el listado.
 */
export async function marcarNoEmitido(
  comprobanteId: string,
  quien: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const filas = await db
    .update(comprobantes)
    .set({
      estado: "error",
      errorMensaje: `Marcado como no emitido por ${quien}, después de revisar Facturante.`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(comprobantes.id, comprobanteId),
        isNull(comprobantes.facturanteId),
        // La misma regla que `sePuedeMarcarNoEmitido`, en el WHERE para que no
        // la gane una carrera con el envío o el webhook.
        or(
          and(
            eq(comprobantes.estado, "en_proceso"),
            lt(comprobantes.enviadoEn, new Date(Date.now() - ESPERA_ENVIO_MS)),
          ),
          and(
            eq(comprobantes.estado, "pendiente"),
            isNull(comprobantes.enviadoEn),
            lt(comprobantes.createdAt, new Date(Date.now() - ESPERA_PENDIENTE_MS)),
          ),
        ),
      ),
    )
    .returning({ id: comprobantes.id });

  return filas.length > 0
    ? { ok: true }
    : {
        ok: false,
        error: "Ese comprobante no se puede marcar: ya se resolvió o todavía está en camino.",
      };
}
