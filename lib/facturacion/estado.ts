import type { Comprobante } from "@/lib/db/schema";

/**
 * En qué anda la facturación de un cobro, visto desde sus comprobantes.
 * Lógica pura, sin base: la usan la pantalla y las actions, y tienen que
 * decidir lo mismo.
 *
 * Simplificado de Clicnet (`movimientos-vinculo.ts`): allá un cobro podía
 * colgar de un pago de cuota o de una venta; acá todos son cobros sueltos.
 */
export type EstadoFacturacion =
  | "sin_facturar"
  | "en_proceso"
  | "facturado"
  | "con_error";

export type ComprobanteResumen = Pick<
  Comprobante,
  | "id"
  | "tipo"
  | "letra"
  | "estado"
  | "numeroCompleto"
  | "pdfUrl"
  | "errorMensaje"
  | "createdAt"
>;

export interface Situacion {
  estado: EstadoFacturacion;
  /** La factura que define el estado, si hay alguna. */
  factura: ComprobanteResumen | null;
  /** Su nota de crédito, si la anularon o la están anulando. */
  notaCredito: ComprobanteResumen | null;
}

/**
 * Sólo cuentan las **facturas**: una nota de crédito no factura un cobro, lo
 * desfactura. Entre varias facturas del mismo cobro —una rechazada y después
 * una buena— manda la viva; si no hay viva, la última, para mostrar por qué
 * falló.
 */
export function situacionDe(
  comprobantes: ComprobanteResumen[],
  ncPorFactura: Map<string, ComprobanteResumen>,
): Situacion {
  const facturas = comprobantes
    .filter((c) => c.tipo === "factura")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const viva = facturas.find(
    (f) => f.estado === "autorizado" || f.estado === "pendiente" || f.estado === "en_proceso",
  );
  const factura = viva ?? facturas[0] ?? null;
  const notaCredito = factura ? (ncPorFactura.get(factura.id) ?? null) : null;

  if (!factura) return { estado: "sin_facturar", factura, notaCredito };

  switch (factura.estado) {
    case "autorizado":
      // Una NC en camino deja la factura "en proceso" hasta que se resuelva:
      // no se puede volver a facturar algo que quizás todavía está facturado.
      return {
        estado:
          notaCredito && notaCredito.estado !== "rechazado" && notaCredito.estado !== "error"
            ? "en_proceso"
            : "facturado",
        factura,
        notaCredito,
      };
    case "pendiente":
    case "en_proceso":
      return { estado: "en_proceso", factura, notaCredito };
    case "anulado":
      // Anulada con su NC: el cobro vuelve a estar libre para facturar.
      return { estado: "sin_facturar", factura, notaCredito };
    case "rechazado":
    case "error":
      return { estado: "con_error", factura, notaCredito };
  }
}

export function sePuedeFacturar(s: Situacion): boolean {
  return s.estado === "sin_facturar" || s.estado === "con_error";
}

/**
 * Cuánto se espera desde que salió el POST antes de mandar a revisar a mano.
 * Tiene que cubrir el peor envío posible —token (12 s) + POST (45 s) + un
 * reintento por 401 (otros 57 s)— más el webhook: si se libera el cobro con el
 * POST todavía en vuelo, la factura puede salir igual.
 */
export const ESPERA_ENVIO_MS = 5 * 60 * 1000;
/** Un `pendiente` es un `after()` que no arrancó; el cron usa el mismo plazo. */
export const ESPERA_PENDIENTE_MS = 10 * 60 * 1000;

/**
 * ¿Se puede marcar como no emitido? Sólo sin `facturanteId` (con él, se
 * consulta) y pasada la espera. La pantalla y el UPDATE usan la misma regla.
 */
export function sePuedeMarcarNoEmitido(
  c: { estado: string; facturanteId: string | null; enviadoEn: Date | null; createdAt: Date },
  ahora = Date.now(),
): boolean {
  if (c.facturanteId) return false;
  if (c.estado === "en_proceso") {
    return !!c.enviadoEn && ahora - c.enviadoEn.getTime() > ESPERA_ENVIO_MS;
  }
  if (c.estado === "pendiente") {
    return !c.enviadoEn && ahora - c.createdAt.getTime() > ESPERA_PENDIENTE_MS;
  }
  return false;
}
