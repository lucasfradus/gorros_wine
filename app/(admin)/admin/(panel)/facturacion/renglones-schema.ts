import { z } from "zod";

/**
 * Los renglones llegan como JSON en un input oculto: son una lista de largo
 * variable, y el formulario ya los tiene armados para mostrar las cuentas. Lo
 * que vale es lo que se valida y se calcula acá, no lo que mostró la pantalla.
 */
const renglonesSchema = z
  .array(
    z.object({
      productoId: z.union([z.uuid(), z.null()]),
      descripcion: z.string().trim().min(1, "Falta la descripción de un renglón.").max(200),
      cantidad: z.number().int().min(1).max(9_999),
      precioUnitarioCentavos: z.number().int().positive("Falta el precio de un renglón."),
      descuentoPct: z.number().min(0).max(99.99),
      alcanzado: z.boolean(),
    }),
  )
  .min(1, "Agregá al menos un renglón.")
  .max(50, "Hasta 50 renglones por comprobante.");

export function leerRenglones(texto: FormDataEntryValue | null) {
  let crudo: unknown;
  try {
    crudo = JSON.parse(String(texto ?? ""));
  } catch {
    return { error: "No llegaron los renglones. Recargá la página." } as const;
  }
  const r = renglonesSchema.safeParse(crudo);
  return r.success ? ({ renglones: r.data } as const) : ({ error: r.error.issues[0].message } as const);
}
