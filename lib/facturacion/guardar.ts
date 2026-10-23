import { and, eq, notInArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { comprobantes } from "@/lib/db/schema";
import type { ResultadoDocumento } from "@/lib/facturante/mappers";
import { esDuplicado } from "./emitir";

/**
 * Guardar en la fila lo que Facturante dice de un comprobante.
 *
 * Llega por tres caminos —la respuesta del POST, el webhook y la consulta de
 * estado— y los tres pasan por acá para que las reglas sean una sola (en
 * Clicnet cada uno tenía su copia y la consulta pisaba el CAE con vacíos):
 *
 * - **Un autorizado no se degrada.** El webhook llega ~250 ms después de la
 *   respuesta del POST; si el POST decía "por autorizar" y se escribía último,
 *   devolvía a "en proceso" una factura con CAE.
 * - **Un dato no se borra con un vacío**: el webhook manda campos vacíos.
 * - **Si Facturante tiene el comprobante, el error viejo ya no aplica.**
 *
 * Además, una nota de crédito autorizada deja **anulada** su factura, en la
 * misma transacción: es lo que libera el cobro para volver a facturarlo.
 */
export async function guardarDocumento(
  comprobanteId: string,
  r: ResultadoDocumento,
  responsePayload: unknown,
): Promise<{ actualizado: boolean }> {
  const [actual] = await db
    .select()
    .from(comprobantes)
    .where(eq(comprobantes.id, comprobanteId))
    .limit(1);
  if (!actual) return { actualizado: false };

  const yaAutorizado = actual.estado === "autorizado" || actual.estado === "anulado";
  if (yaAutorizado && r.estado !== "autorizado") return { actualizado: false };

  const datos = {
    facturanteId: r.facturanteId != null ? String(r.facturanteId) : actual.facturanteId,
    cae: r.cae ?? actual.cae,
    caeVencimiento: r.caeVencimiento ?? actual.caeVencimiento,
    numeroCompleto: r.numeroCompleto ?? actual.numeroCompleto,
    pdfUrl: r.pdfUrl ?? actual.pdfUrl,
    qrUrl: r.qrUrl ?? actual.qrUrl,
    totalCentavos: r.totalCentavos ?? actual.totalCentavos,
    responsePayload: responsePayload ?? actual.responsePayload,
    updatedAt: new Date(),
  };

  try {
    return await db.transaction(async (tx) => {
      const filas = await tx
        .update(comprobantes)
        .set({
          ...datos,
          // Una factura ya anulada sigue anulada aunque llegue de nuevo su webhook.
          estado: actual.estado === "anulado" ? "anulado" : r.estado,
          // Rechazado conserva el motivo que hubiera: el documento no lo trae.
          ...(r.estado !== "rechazado" ? { errorCodigo: null, errorMensaje: null } : {}),
        })
        .where(
          and(
            eq(comprobantes.id, comprobanteId),
            // La misma guarda en el WHERE: entre la lectura y esta escritura
            // pudo haber entrado el webhook con el CAE.
            r.estado === "autorizado"
              ? undefined
              : notInArray(comprobantes.estado, ["autorizado", "anulado"]),
          ),
        )
        .returning({ id: comprobantes.id });

      if (
        filas.length > 0 &&
        r.estado === "autorizado" &&
        actual.tipo === "nota_credito" &&
        actual.origenId
      ) {
        await tx
          .update(comprobantes)
          .set({ estado: "anulado", updatedAt: new Date() })
          .where(and(eq(comprobantes.id, actual.origenId), eq(comprobantes.estado, "autorizado")));
      }
      return { actualizado: filas.length > 0 };
    });
  } catch (e) {
    if (!esDuplicado(e)) throw e;

    // Un comprobante que se dio por no emitido (o rechazado) y Facturante igual
    // autorizó, cuando el cobro ya tiene otra factura viva: el índice único no
    // deja revivirlo. El cobro quedó facturado dos veces de verdad. Se guardan
    // el CAE y el número sin cambiar el estado, y se deja a la vista: hay que
    // anularlo con nota de crédito desde Facturante.
    console.error(
      `[facturacion] DUPLICADO: ${comprobanteId} quedó autorizado (${r.numeroCompleto}) y el cobro ya tenía otro comprobante vivo`,
    );
    await db
      .update(comprobantes)
      .set({
        ...datos,
        errorCodigo: "DUPLICADO",
        errorMensaje: `Facturante lo autorizó igual (${r.numeroCompleto ?? "sin número"}) y el cobro ya tiene otra factura: anulalo con nota de crédito desde Facturante.`,
      })
      .where(eq(comprobantes.id, comprobanteId));
    return { actualizado: true };
  }
}
