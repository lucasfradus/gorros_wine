"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { documentoTipo, formaPago } from "@/lib/db/schema";
import { requireFacturacion } from "@/lib/auth";
import { anularDocumento, guardarDocumento } from "@/lib/facturacion/documentos";
import type { FormState } from "../../form-ui";
import { leerRenglones } from "../renglones-schema";

/**
 * Presupuestos y recibos. Como las de facturación, arrancan por
 * `requireFacturacion()`: una Server Action se puede llamar sin pasar por la
 * página.
 */

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elegí la fecha.");

const documentoSchema = z.object({
  id: z.uuid(),
  tipo: z.enum(documentoTipo.enumValues, { error: "Elegí si es presupuesto o recibo." }),
  // Las reglas de la fecha (real, sin errores de tipeo) las aplica `guardarDocumento`.
  fecha: dia,
  clienteId: z.union([z.uuid(), z.literal("")]),
  receptorNombre: z.string().trim().max(160),
  receptorDocumento: z.string().trim().max(40),
  formaPago: z.union([z.enum(formaPago.enumValues), z.literal("")]),
  validoHasta: z.union([dia, z.literal("")]),
  observaciones: z.string().trim().max(1000),
});

export async function emitirDocumentoAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireFacturacion();

  const campos = Object.keys(documentoSchema.shape);
  const parsed = documentoSchema.safeParse(
    Object.fromEntries(campos.map((c) => [c, String(formData.get(c) ?? "").trim()])),
  );
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const leidos = leerRenglones(formData.get("renglones"));
  if ("error" in leidos) return { error: leidos.error };

  const d = parsed.data;
  const r = await guardarDocumento({
    ...d,
    renglones: leidos.renglones,
    clienteId: d.clienteId || null,
    formaPago: d.formaPago || null,
    validoHasta: d.validoHasta || null,
    actorId: user.id,
  });
  if (!r.ok) return { error: r.error };

  revalidatePath("/admin/facturacion/documentos");
  redirect(`/admin/facturacion/documentos/${r.id}`);
}

export async function anularDocumentoAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireFacturacion();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Falta el documento." };

  const r = await anularDocumento(id.data);
  revalidatePath("/admin/facturacion/documentos", "layout");
  return r.ok ? { ok: "Anulado." } : { error: r.error };
}
