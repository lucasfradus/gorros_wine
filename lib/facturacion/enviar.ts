import { and, eq, notInArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { comprobantes } from "@/lib/db/schema";
import { configFacturante, webhookFacturante } from "@/lib/facturante/config";
import { emitirEnFacturante } from "@/lib/facturante/client";
import { clasificarFallo } from "@/lib/facturante/errors";
import { conWebhook, parseDocumento } from "@/lib/facturante/mappers";
import type { DocumentoResponse, ElectronicDocument } from "@/lib/facturante/types";
import { guardarDocumento } from "./guardar";


const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Lo que volvió del POST tiene que quedar escrito: es la única prueba de que
 * el comprobante existe. Si la base falla justo ahora, se reintenta, y como
 * último recurso se guarda al menos el id de Facturante, que es lo que permite
 * consultarlo después. Sin él, a los minutos la pantalla ofrecería "no se
 * emitió" sobre una factura que sí salió.
 */
async function guardarRespuesta(comprobanteId: string, doc: DocumentoResponse) {
  for (let intento = 0; intento < 3; intento++) {
    try {
      await guardarDocumento(comprobanteId, parseDocumento(doc), doc);
      return;
    } catch (e) {
      console.error(`[facturacion] ${comprobanteId}: no se pudo guardar la respuesta (intento ${intento + 1}):`, e);
      await esperar(1000 * (intento + 1));
    }
  }
  const internalId = doc.identifications?.internalId;
  console.error(
    `[facturacion] ${comprobanteId}: Facturante respondió (id ${internalId}, ${doc.fiscalData?.fullNumber}) y no se pudo guardar`,
  );
  await db
    .update(comprobantes)
    .set({
      facturanteId: internalId ? String(internalId) : null,
      responsePayload: doc,
      errorMensaje: "Facturante respondió pero no se pudo guardar el resultado: tocá Consultar estado.",
      updatedAt: new Date(),
    })
    .where(eq(comprobantes.id, comprobanteId));
}

/**
 * Manda a Facturante un comprobante ya reservado y guarda el desenlace.
 *
 * No lanza: corre dentro de `after()`, donde una excepción no la ve nadie, así
 * que todo desenlace queda escrito en la fila.
 */
export async function enviarComprobante(comprobanteId: string): Promise<void> {
  try {
    await enviar(comprobanteId);
  } catch (e) {
    console.error(`[facturacion] ${comprobanteId}: error inesperado al enviar:`, e);
  }
}

async function enviar(comprobanteId: string) {
  const cfg = configFacturante();
  const [fila] = await db
    .select({ estado: comprobantes.estado, request: comprobantes.requestPayload })
    .from(comprobantes)
    .where(eq(comprobantes.id, comprobanteId))
    .limit(1);

  if (!fila || fila.estado !== "pendiente") return;
  if (!cfg) {
    await db
      .update(comprobantes)
      .set({ estado: "error", errorMensaje: "Falta la configuración de Facturante.", updatedAt: new Date() })
      .where(and(eq(comprobantes.id, comprobanteId), eq(comprobantes.estado, "pendiente")));
    return;
  }

  // "Salió el POST" se marca ANTES de mandarlo: si el proceso muere en el
  // medio, la fila queda en proceso con fecha de envío, y no pendiente para
  // siempre (pendiente quiere decir "seguro que no salió").
  const marcadas = await db
    .update(comprobantes)
    .set({ estado: "en_proceso", enviadoEn: new Date(), errorCodigo: null, errorMensaje: null, updatedAt: new Date() })
    .where(and(eq(comprobantes.id, comprobanteId), eq(comprobantes.estado, "pendiente")))
    .returning({ id: comprobantes.id });
  // Otro proceso ya lo tomó: mandarlo de nuevo sería duplicarlo.
  if (marcadas.length === 0) return;

  let doc: DocumentoResponse;
  try {
    doc = await emitirEnFacturante(
      cfg,
      conWebhook(fila.request as ElectronicDocument, webhookFacturante()),
    );
  } catch (e) {
    const f = clasificarFallo(e);
    if (f.estado === "en_proceso") {
      console.warn(`[facturacion] ${comprobanteId} enviado sin confirmación: ${f.mensaje}`);
    } else {
      console.error(`[facturacion] ${comprobanteId} no se emitió: ${f.mensaje}`);
    }
    // Con un timeout, el webhook pudo llegar mientras esperábamos: lo que ya
    // tiene CAE no vuelve atrás.
    await db
      .update(comprobantes)
      .set({ estado: f.estado, errorCodigo: f.codigo, errorMensaje: f.mensaje, updatedAt: new Date() })
      .where(
        and(eq(comprobantes.id, comprobanteId), notInArray(comprobantes.estado, ["autorizado", "anulado"])),
      );
    return;
  }

  await guardarRespuesta(comprobanteId, doc);
}
