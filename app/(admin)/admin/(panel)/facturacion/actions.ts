"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { condicionIva, cuentasMp, formaPago } from "@/lib/db/schema";
import { requireFacturacion } from "@/lib/auth";
import { sincronizarPagos } from "@/lib/mercadopago/sync";
import {
  reservarFactura,
  reservarFacturaManual,
  reservarNotaCredito,
} from "@/lib/facturacion/emitir";
import { enviarComprobante } from "@/lib/facturacion/enviar";
import { consultarEstado, marcarNoEmitido } from "@/lib/facturacion/reconciliar";
import type { FormState } from "../form-ui";

/**
 * Actions de la sección Facturación. Todas arrancan por
 * `requireFacturacion()`: la página ya la pide, pero una Server Action es un
 * endpoint POST que se puede llamar sin pasar por la página.
 */

const DIA = 24 * 60 * 60 * 1000;

const syncSchema = z.object({
  dias: z.coerce.number().int().min(1).max(90).default(7),
});

export async function sincronizarAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireFacturacion();

  const parsed = syncSchema.safeParse({ dias: formData.get("dias") ?? undefined });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const hasta = new Date();
  const desde = new Date(hasta.getTime() - parsed.data.dias * DIA);

  let r;
  try {
    r = await sincronizarPagos({ desde, hasta });
  } catch (e) {
    console.error("[facturacion] sync:", e);
    return { error: "No se pudo consultar Mercado Pago. Probá de nuevo en un rato." };
  }

  revalidatePath("/admin/facturacion/cobros");

  if (r.cuentas === 0) return { error: "No hay ninguna cuenta de Mercado Pago vinculada." };
  if (r.fallidas.length > 0) {
    return {
      error: `Mercado Pago no respondió para ${r.fallidas
        .map((f) => f.alias)
        .join(", ")}: ${r.fallidas[0].error}. Si dice 401, hay que volver a vincular la cuenta.`,
    };
  }
  return {
    ok:
      r.nuevos === 0
        ? `Al día: no entró ningún cobro nuevo en los últimos ${parsed.data.dias} días.`
        : `${r.nuevos} cobro${r.nuevos === 1 ? "" : "s"} nuevo${r.nuevos === 1 ? "" : "s"}.`,
  };
}

export async function desactivarCuentaAction(formData: FormData): Promise<void> {
  await requireFacturacion();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  // Se desactiva y no se borra: los cobros ya sincronizados cuelgan de la
  // cuenta, y sus facturas de los cobros.
  await db
    .update(cuentasMp)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(cuentasMp.id, id.data));

  revalidatePath("/admin/facturacion", "layout");
}

// ── Emisión ────────────────────────────────────────────────────────────────

const texto = (max: number) => z.string().trim().max(max);

/** El receptor: lo comparten la factura de un cobro y la manual. */
const receptorSchema = z.object({
  clienteId: z.union([z.uuid(), z.literal("")]),
  condicionIva: z.enum(condicionIva.enumValues, {
    error: "Elegí la condición frente al IVA.",
  }),
  docTipo: z.enum(["cuit", "dni", "ninguno"]),
  docNumero: texto(20),
  nombre: texto(160),
  email: z.union([z.email({ error: "El mail no es válido." }), z.literal("")]),
  calle: texto(200),
  ciudad: texto(100),
  provincia: texto(10),
});

const facturaSchema = receptorSchema.extend({ movimientoId: z.uuid() });

/** Los campos que no vienen (inputs ocultos según la condición) valen "". */
const leer = (fd: FormData, campos: string[]) =>
  Object.fromEntries(campos.map((c) => [c, String(fd.get(c) ?? "").trim()]));

/**
 * Reserva la factura y la manda en `after()`: Facturante tarda 13-20 s, y el
 * formulario no tiene por qué esperar. La página se refresca sola mientras
 * haya algo emitiéndose.
 */
export async function emitirFacturaAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireFacturacion();

  const parsed = facturaSchema.safeParse(leer(formData, Object.keys(facturaSchema.shape)));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { movimientoId, clienteId, ...datos } = parsed.data;

  const r = await reservarFactura({
    movimientoId,
    datos,
    clienteId: clienteId || null,
    guardarCliente: formData.get("guardarCliente") === "on",
    actorId: user.id,
  });
  if (!r.ok) return { error: r.error };

  after(() => enviarComprobante(r.comprobanteId));
  revalidatePath("/admin/facturacion", "layout");
  // La factura puede haber creado o completado un cliente.
  revalidatePath("/admin/clientes", "layout");
  return { ok: "Emitiendo la factura. Tarda unos 20 segundos." };
}

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
  .max(50, "Hasta 50 renglones por factura.");

const facturaManualSchema = receptorSchema.extend({
  id: z.uuid(),
  formaPago: z.enum(formaPago.enumValues, { error: "Elegí la forma de pago." }),
  // El rango (hasta 5 días atrás, correlativa) lo valida `reservar`.
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elegí la fecha de la factura."),
});

function leerRenglones(texto: FormDataEntryValue | null) {
  let crudo: unknown;
  try {
    crudo = JSON.parse(String(texto ?? ""));
  } catch {
    return { error: "No llegaron los renglones. Recargá la página." } as const;
  }
  const r = renglonesSchema.safeParse(crudo);
  return r.success ? ({ renglones: r.data } as const) : ({ error: r.error.issues[0].message } as const);
}

/**
 * Factura de una venta que no pasó por MP. Reserva, manda en `after()` y lleva
 * al detalle, que se refresca solo hasta que llega el CAE.
 */
export async function emitirFacturaManualAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireFacturacion();

  const parsed = facturaManualSchema.safeParse(
    leer(formData, Object.keys(facturaManualSchema.shape)),
  );
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const leidos = leerRenglones(formData.get("renglones"));
  if ("error" in leidos) return { error: leidos.error };

  const { id, clienteId, formaPago: forma, fecha, ...datos } = parsed.data;
  const r = await reservarFacturaManual({
    id,
    renglones: leidos.renglones,
    percepcionIva: formData.get("percepcionIva") === "on",
    formaPago: forma,
    datos,
    clienteId: clienteId || null,
    guardarCliente: formData.get("guardarCliente") === "on",
    dia: fecha,
    actorId: user.id,
  });
  if (!r.ok) return { error: r.error };

  after(() => enviarComprobante(r.comprobanteId));
  revalidatePath("/admin/facturacion", "layout");
  // La factura puede haber creado o completado un cliente.
  revalidatePath("/admin/clientes", "layout");
  redirect(`/admin/facturacion/manual/${r.comprobanteId}`);
}

const idSchema = z.object({ id: z.uuid() });

export async function anularFacturaAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireFacturacion();
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Falta la factura." };

  const r = await reservarNotaCredito({ facturaId: parsed.data.id, actorId: user.id });
  if (!r.ok) return { error: r.error };

  after(() => enviarComprobante(r.comprobanteId));
  revalidatePath("/admin/facturacion", "layout");
  return { ok: "Emitiendo la nota de crédito. Tarda unos 20 segundos." };
}

export async function consultarEstadoAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireFacturacion();
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Falta el comprobante." };

  const r = await consultarEstado(parsed.data.id);
  revalidatePath("/admin/facturacion", "layout");
  if (!r.ok) return { error: r.error };
  return {
    ok:
      r.estado === "autorizado"
        ? "Autorizado."
        : r.estado === "rechazado"
          ? "Facturante lo rechazó."
          : "Facturante todavía no lo autorizó.",
  };
}

export async function marcarNoEmitidoAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireFacturacion();
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Falta el comprobante." };

  const r = await marcarNoEmitido(parsed.data.id, user.name);
  revalidatePath("/admin/facturacion", "layout");
  return r.ok ? { ok: "Listo: quedó como no emitido y se puede volver a facturar." } : { error: r.error };
}
