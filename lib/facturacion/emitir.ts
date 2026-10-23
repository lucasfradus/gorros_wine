import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { clientes, comprobantes, movimientosMp } from "@/lib/db/schema";
import { configFacturante } from "@/lib/facturante/config";
import {
  mapFactura,
  mapNotaCredito,
  numeroDeComprobante,
  prefijoDeComprobante,
} from "@/lib/facturante/mappers";
import type { DocumentoResponse, ElectronicDocument } from "@/lib/facturante/types";
import { hoyEnArgentina } from "@/lib/format";
import { validarReceptor, type DatosReceptor } from "./reglas";

/**
 * Reservar un comprobante: validar, armar el request y dejar la fila
 * `pendiente`. Es la parte rápida; el envío (13-20 s) lo hace `enviar.ts`
 * dentro de `after()`, para no colgar el formulario.
 *
 * El request se guarda en la fila antes de mandarlo: si algo sale mal, se sabe
 * exactamente qué se pidió, y la nota de crédito lo necesita para copiar
 * receptor, ítems y fecha.
 */

export type Reserva = { ok: true; comprobanteId: string } | { ok: false; error: string };

/** Lo que manda Postgres cuando choca un unique: drizzle lo envuelve en `cause`. */
export function esDuplicado(e: unknown): boolean {
  const codigo = (x: unknown) => (x as { code?: string } | null | undefined)?.code;
  return codigo(e) === "23505" || codigo((e as { cause?: unknown } | null)?.cause) === "23505";
}

const DESCRIPCION_POR_DEFECTO = "Vinos y productos";

export async function reservarFactura(opts: {
  movimientoId: string;
  datos: DatosReceptor;
  clienteId: string | null;
  actorId: string;
}): Promise<Reserva> {
  const cfg = configFacturante();
  if (!cfg) return { ok: false, error: "Falta la configuración de Facturante en el entorno." };

  const [mov] = await db
    .select()
    .from(movimientosMp)
    .where(eq(movimientosMp.id, opts.movimientoId))
    .limit(1);
  if (!mov) return { ok: false, error: "No se encontró el cobro." };
  if (mov.montoCentavos <= 0) return { ok: false, error: "El cobro no tiene importe." };

  const v = validarReceptor(opts.datos, mov.montoCentavos);
  if (!v.ok) return v;

  if (opts.clienteId) {
    const [cli] = await db
      .select({ id: clientes.id })
      .from(clientes)
      .where(eq(clientes.id, opts.clienteId))
      .limit(1);
    if (!cli) return { ok: false, error: "No se encontró el cliente." };
  }

  const id = randomUUID();
  const externalId = `gorros-f-${id}`;
  const request = mapFactura({
    letra: v.letra,
    receptor: v.receptor,
    importeCentavos: mov.montoCentavos,
    descripcion: (mov.descripcion?.trim() || DESCRIPCION_POR_DEFECTO).slice(0, 200),
    // En hora de Argentina: en UTC, después de las 21 sería "mañana", y con
    // facturas manuales del día eso choca con 100014.
    dia: hoyEnArgentina(),
    externalId,
    posId: cfg.posId,
  });

  try {
    await db.insert(comprobantes).values({
      id,
      movimientoId: mov.id,
      tipo: "factura",
      letra: v.letra,
      estado: "pendiente",
      externalId,
      totalCentavos: mov.montoCentavos,
      receptorDocTipo: v.receptor.docTipo,
      receptorDocNumero: v.receptor.docNumero ?? "0",
      receptorNombre: v.receptor.nombre,
      receptorCondicionIva: v.receptor.condicionIva,
      clienteId: opts.clienteId,
      requestPayload: request,
      emitidoPor: opts.actorId,
    });
  } catch (e) {
    if (esDuplicado(e)) {
      return { ok: false, error: "Ese cobro ya tiene una factura, o se está emitiendo." };
    }
    throw e;
  }

  // Al cliente que todavía no tenía condición frente al IVA se le guarda la
  // que se usó, así la próxima vez sale precargada. Lo que ya tenía no se pisa.
  if (opts.clienteId) {
    await db
      .update(clientes)
      .set({ condicionIva: v.receptor.condicionIva, updatedAt: new Date() })
      .where(and(eq(clientes.id, opts.clienteId), isNull(clientes.condicionIva)));
  }

  return { ok: true, comprobanteId: id };
}

/** Nota de crédito por el total de una factura autorizada. */
export async function reservarNotaCredito(opts: {
  facturaId: string;
  actorId: string;
}): Promise<Reserva> {
  const cfg = configFacturante();
  if (!cfg) return { ok: false, error: "Falta la configuración de Facturante en el entorno." };

  const [f] = await db
    .select()
    .from(comprobantes)
    .where(eq(comprobantes.id, opts.facturaId))
    .limit(1);
  if (!f || f.tipo !== "factura") return { ok: false, error: "No se encontró la factura." };
  if (f.estado !== "autorizado") {
    return { ok: false, error: "Sólo se anula una factura autorizada." };
  }

  const facturaRequest = f.requestPayload as ElectronicDocument | null;
  const respuesta = f.responsePayload as DocumentoResponse | null;
  const numero = numeroDeComprobante(respuesta, f.numeroCompleto);
  const prefijo = prefijoDeComprobante(respuesta, f.numeroCompleto);
  const fecha = facturaRequest?.header?.detail?.dates?.[0]?.dateTime;
  if (!facturaRequest || !numero || !prefijo || !fecha) {
    return {
      ok: false,
      error: "A la factura le faltan datos para asociarle la nota de crédito. Anulala desde Facturante.",
    };
  }

  const id = randomUUID();
  const externalId = `gorros-nc-${id}`;
  const request = mapNotaCredito(
    facturaRequest,
    { posId: cfg.posId, posPrefix: prefijo, number: numero, cuitEmisor: cfg.emisorCuit, fecha },
    { dia: hoyEnArgentina(), externalId },
  );

  try {
    await db.insert(comprobantes).values({
      id,
      movimientoId: f.movimientoId,
      tipo: "nota_credito",
      letra: f.letra,
      estado: "pendiente",
      externalId,
      totalCentavos: f.totalCentavos,
      receptorDocTipo: f.receptorDocTipo,
      receptorDocNumero: f.receptorDocNumero,
      receptorNombre: f.receptorNombre,
      receptorCondicionIva: f.receptorCondicionIva,
      clienteId: f.clienteId,
      origenId: f.id,
      requestPayload: request,
      emitidoPor: opts.actorId,
    });
  } catch (e) {
    if (esDuplicado(e)) {
      return { ok: false, error: "Esa factura ya tiene una nota de crédito en camino." };
    }
    throw e;
  }

  return { ok: true, comprobanteId: id };
}
