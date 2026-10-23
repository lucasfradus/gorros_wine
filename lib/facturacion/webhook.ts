import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { comprobantes } from "@/lib/db/schema";
import { parseDocumento } from "@/lib/facturante/mappers";
import {
  extraerDocumentoWebhook,
  normalizarDocumentoWebhook,
} from "@/lib/facturante/webhook-payload";
import { guardarDocumento } from "./guardar";

export type ResultadoWebhook =
  | { estado: "actualizado" | "sin_cambios"; comprobanteId: string }
  | { estado: "desconocido" | "invalido" };

/**
 * La notificación de Facturante de que un comprobante quedó autorizado. Es lo
 * que cierra un envío que se cortó por timeout. Idempotente: Facturante
 * reintenta, y `guardarDocumento` no pisa nada con lo mismo.
 */
export async function procesarWebhookFacturante(body: unknown): Promise<ResultadoWebhook> {
  const crudo = extraerDocumentoWebhook(body);
  if (!crudo) return { estado: "invalido" };

  const doc = normalizarDocumentoWebhook(crudo);
  const r = parseDocumento(doc);
  const externalId = doc.identifications.externalId;

  // El externalId es nuestro y es la vía buena; el id interno, por si acaso.
  const [c] = externalId
    ? await db
        .select({ id: comprobantes.id })
        .from(comprobantes)
        .where(eq(comprobantes.externalId, externalId))
        .limit(1)
    : r.facturanteId
      ? await db
          .select({ id: comprobantes.id })
          .from(comprobantes)
          .where(eq(comprobantes.facturanteId, String(r.facturanteId)))
          .limit(1)
      : [];

  if (!c) return { estado: "desconocido" };

  const { actualizado } = await guardarDocumento(c.id, r, crudo);
  return { estado: actualizado ? "actualizado" : "sin_cambios", comprobanteId: c.id };
}
