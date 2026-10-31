import { and, asc, eq, inArray, isNull, notInArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  clientes,
  comprobantes,
  documentoItems,
  documentos,
  productos,
  type DocumentoTipo,
  type FormaPago,
} from "@/lib/db/schema";
import { hoyEnArgentina } from "@/lib/format";
import { calcular, validarRenglones, type Renglon } from "./calculo";
import { esDuplicado } from "./duplicado";
import type { Tx } from "./emitir";
import { validarFechaLibre } from "./reglas";

/**
 * Presupuestos y recibos: lo mismo que una factura manual en contenido, pero
 * sin Facturante, sin letra y sin reglas fiscales de fecha. Se guardan de una
 * vez, sin estados intermedios: no hay nada que esperar.
 */

export const NOMBRE_DOCUMENTO: Record<DocumentoTipo, string> = {
  presupuesto: "Presupuesto",
  recibo: "Recibo",
};

/** "0007": el número como se imprime. */
export const numeroDocumento = (n: number) => String(n).padStart(4, "0");

export type ReservaDocumento = { ok: true; id: string } | { ok: false; error: string };

/** El nombre del índice que numera: si choca ése, es otro documento que se
 *  llevó el número al mismo tiempo, y se reintenta con el siguiente. */
const INDICE_NUMERO = "documentos_tipo_numero_idx";
const chocoElNumero = (e: unknown) => {
  const r = e as { constraint?: string; cause?: { constraint?: string } } | null;
  return (r?.constraint ?? r?.cause?.constraint) === INDICE_NUMERO;
};

export async function guardarDocumento(o: {
  id: string;
  tipo: DocumentoTipo;
  fecha: string;
  renglones: Renglon[];
  clienteId: string | null;
  receptorNombre: string;
  receptorDocumento: string;
  formaPago: FormaPago | null;
  validoHasta: string | null;
  observaciones: string;
  actorId: string;
}): Promise<ReservaDocumento> {
  const errorRenglones = validarRenglones(o.renglones);
  if (errorRenglones) return { ok: false, error: errorRenglones };

  const hoy = hoyEnArgentina();
  const errorFecha = validarFechaLibre(o.fecha, hoy);
  if (errorFecha) return { ok: false, error: errorFecha };
  if (o.tipo === "presupuesto" && o.validoHasta) {
    const e = validarFechaLibre(o.validoHasta, hoy);
    if (e) return { ok: false, error: `Válido hasta: ${e.toLowerCase()}` };
    if (o.validoHasta < o.fecha) {
      return { ok: false, error: "El presupuesto no puede vencer antes de su fecha." };
    }
  }
  if (o.tipo === "recibo" && !o.formaPago) {
    return { ok: false, error: "Elegí cómo se pagó." };
  }

  let nombre = o.receptorNombre.trim();
  let documento = o.receptorDocumento.trim();
  if (o.clienteId) {
    const [cli] = await db
      .select({ nombre: clientes.nombre, razonSocial: clientes.razonSocial, documento: clientes.documento })
      .from(clientes)
      .where(eq(clientes.id, o.clienteId))
      .limit(1);
    if (!cli) return { ok: false, error: "No se encontró el cliente." };
    // Lo tipeado manda; si no se tipeó nada, se copia lo del cliente.
    nombre ||= cli.razonSocial ?? cli.nombre;
    documento ||= cli.documento ?? "";
  }

  const productoIds = [...new Set(o.renglones.flatMap((r) => (r.productoId ? [r.productoId] : [])))];
  if (productoIds.length) {
    const hay = await db
      .select({ id: productos.id })
      .from(productos)
      .where(inArray(productos.id, productoIds));
    if (hay.length !== productoIds.length) {
      return { ok: false, error: "Uno de los productos ya no existe: volvé a elegirlo." };
    }
  }

  // Sin percepción: no es una factura, y la percepción sólo existe en una.
  const calc = calcular(o.renglones, { percepcionIva: false });

  const insertar = () =>
    db.transaction(async (tx) => {
      const [{ siguiente }] = await tx
        .select({ siguiente: sql<number>`coalesce(max(${documentos.numero}), 0) + 1`.mapWith(Number) })
        .from(documentos)
        .where(eq(documentos.tipo, o.tipo));
      await tx.insert(documentos).values({
        id: o.id,
        tipo: o.tipo,
        numero: siguiente,
        fecha: o.fecha,
        clienteId: o.clienteId,
        receptorNombre: nombre || null,
        receptorDocumento: documento || null,
        formaPago: o.tipo === "recibo" ? o.formaPago : null,
        validoHasta: o.tipo === "presupuesto" ? o.validoHasta : null,
        observaciones: o.observaciones.trim() || null,
        totalCentavos: calc.totalCentavos,
        creadoPor: o.actorId,
      });
      await tx.insert(documentoItems).values(
        calc.renglones.map((r, i) => ({
          documentoId: o.id,
          productoId: r.productoId,
          orden: i,
          descripcion: r.descripcion,
          cantidad: r.cantidad,
          precioUnitarioCentavos: r.precioUnitarioCentavos,
          descuentoPct: r.descuentoPct,
          subtotalCentavos: r.subtotalCentavos,
        })),
      );
    });

  // Dos intentos alcanzan: para chocar dos veces seguidas haría falta una
  // tercera persona guardando en el mismo instante.
  for (let intento = 0; ; intento++) {
    try {
      await insertar();
      return { ok: true, id: o.id };
    } catch (e) {
      if (chocoElNumero(e) && intento === 0) continue;
      if (esDuplicado(e)) {
        return {
          ok: false,
          error: chocoElNumero(e)
            ? "No se pudo numerar: probá de nuevo."
            : `Ese ${NOMBRE_DOCUMENTO[o.tipo].toLowerCase()} ya se guardó.`,
        };
      }
      throw e;
    }
  }
}

export async function anularDocumento(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await db
    .update(documentos)
    .set({ anulado: true, updatedAt: new Date() })
    .where(and(eq(documentos.id, id), eq(documentos.anulado, false)))
    .returning({ id: documentos.id });
  return r.length ? { ok: true } : { ok: false, error: "Ya estaba anulado, o no existe." };
}

/** El documento con sus renglones, en el orden en que se cargaron. */
export async function documentoConItems(id: string) {
  const [doc] = await db.select().from(documentos).where(eq(documentos.id, id)).limit(1);
  if (!doc) return null;
  const items = await db
    .select()
    .from(documentoItems)
    .where(eq(documentoItems.documentoId, id))
    .orderBy(asc(documentoItems.orden));
  return { doc, items };
}

/**
 * Una factura que ya no cuenta: rechazada, que nunca salió, o anulada con su
 * NC. El documento que la originó se puede volver a facturar. Es el mismo
 * criterio que el índice de factura viva de `comprobantes`.
 */
export const FACTURA_MUERTA = ["rechazado", "error", "anulado"] as const;

export const facturaViva = (estado: string | null | undefined) =>
  !!estado && !(FACTURA_MUERTA as readonly string[]).includes(estado);

export class DocumentoNoFacturable extends Error {}

/**
 * Deja asentado en el documento qué factura salió de él. Va dentro de la
 * transacción de la reserva: si el documento ya tiene una factura viva (otra
 * pestaña, un doble clic) o se anuló, la factura no se reserva.
 */
export async function enlazarFactura(tx: Tx, documentoId: string, facturaId: string) {
  const muertas = tx
    .select({ id: comprobantes.id })
    .from(comprobantes)
    .where(inArray(comprobantes.estado, [...FACTURA_MUERTA]));
  const r = await tx
    .update(documentos)
    .set({ facturaId, updatedAt: new Date() })
    .where(
      and(
        eq(documentos.id, documentoId),
        eq(documentos.anulado, false),
        or(isNull(documentos.facturaId), inArray(documentos.facturaId, muertas)),
      ),
    )
    .returning({ id: documentos.id });
  if (!r.length) throw new DocumentoNoFacturable();
}
