import { z } from "zod";

/**
 * Mapeo de un pago de la API de Mercado Pago a una fila de `movimientos_mp`.
 *
 * Sin base ni red, para poder probar el mapeo contra respuestas reales sin
 * levantar nada. Portado de Clicnet (`movimientos-map.ts`), más el documento
 * del pagador, que allá no hacía falta.
 *
 * El schema es permisivo —todo opcional— porque MP agrega campos sin avisar y
 * un campo nuevo no puede romper el barrido.
 */
export const pagoMpSchema = z.object({
  id: z.union([z.string(), z.number()]).nullish(),
  status: z.string().nullish(),
  description: z.string().nullish(),
  transaction_amount: z.number().nullish(),
  net_received_amount: z.number().nullish(),
  fee_details: z.array(z.object({ amount: z.number().nullish() })).nullish(),
  payment_method_id: z.string().nullish(),
  payer: z
    .object({
      first_name: z.string().nullish(),
      last_name: z.string().nullish(),
      email: z.string().nullish(),
      identification: z
        .object({ type: z.string().nullish(), number: z.string().nullish() })
        .nullish(),
    })
    .nullish(),
  date_created: z.string().nullish(),
  date_approved: z.string().nullish(),
});
export type PagoMp = z.infer<typeof pagoMpSchema>;

export const respuestaBusquedaSchema = z.object({
  paging: z
    .object({
      total: z.number().nullish(),
      limit: z.number().nullish(),
      offset: z.number().nullish(),
    })
    .nullish(),
  // `passthrough` para guardar el pago entero en `raw`, no sólo lo que se mapea.
  results: z.array(pagoMpSchema.passthrough()).nullish(),
});

export interface PagoMapeado {
  mpPagoId: string;
  montoCentavos: number;
  netoCentavos: number | null;
  comisionCentavos: number | null;
  titular: string | null;
  email: string | null;
  docTipo: string | null;
  docNumero: string | null;
  metodoPago: string | null;
  descripcion: string | null;
  fechaAprobacion: Date;
  raw: unknown;
}

/** MP informa pesos con decimales; acá todo es centavos enteros. */
const centavos = (x: number) => Math.round(x * 100);

/**
 * Convierte un pago de MP en los datos de la fila. Devuelve `null` si le falta
 * el id —sin él no hay clave de upsert— o la fecha de aprobación, que es la que
 * va en la factura. Con `status=approved` las dos vienen siempre; esto es la red
 * por si no.
 */
export function mapearPago(raw: PagoMp): PagoMapeado | null {
  if (raw.id == null || !raw.date_approved) return null;

  // MP informa las comisiones como una lista de conceptos; interesa el total.
  const comision = raw.fee_details?.length
    ? raw.fee_details.reduce((s, f) => s + (f.amount ?? 0), 0)
    : null;

  const nombre = [raw.payer?.first_name, raw.payer?.last_name]
    .filter((x): x is string => !!x?.trim())
    .join(" ")
    .trim();

  const doc = raw.payer?.identification;

  return {
    mpPagoId: String(raw.id),
    montoCentavos: centavos(raw.transaction_amount ?? 0),
    netoCentavos:
      raw.net_received_amount != null ? centavos(raw.net_received_amount) : null,
    comisionCentavos: comision != null ? centavos(comision) : null,
    titular: nombre || null,
    email: raw.payer?.email ?? null,
    docTipo: doc?.type ?? null,
    docNumero: doc?.number?.replace(/\D/g, "") || null,
    metodoPago: raw.payment_method_id ?? null,
    descripcion: raw.description?.trim() || null,
    // `date_approved` es cuándo entró la plata y es la fecha que vale para
    // facturar. `date_created` es cuándo se inició el pago, que puede ser de
    // otro día.
    fechaAprobacion: new Date(raw.date_approved),
    raw,
  };
}

export function construirUrlBusqueda(
  desde: Date,
  hasta: Date,
  offset: number,
  limit: number,
): string {
  const qs = new URLSearchParams({
    sort: "date_approved",
    criteria: "desc",
    range: "date_approved",
    begin_date: desde.toISOString(),
    end_date: hasta.toISOString(),
    status: "approved",
    limit: String(limit),
    offset: String(offset),
  });
  return `https://api.mercadopago.com/v1/payments/search?${qs}`;
}
