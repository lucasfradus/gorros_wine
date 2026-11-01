import { and, asc, eq, inArray, notInArray, sql } from "drizzle-orm";
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
import { esDuplicado, indiceDuplicado } from "./duplicado";
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

/** Si choca este índice, es otro documento que se llevó el número al mismo
 *  tiempo, y se reintenta con el siguiente. */
const chocoElNumero = (e: unknown) => indiceDuplicado(e) === "documentos_tipo_numero_idx";

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

/**
 * Uno que ya tiene una factura viva no se anula: lo que se anula es la
 * factura, con su NC. El documento se bloquea mientras se mira, para que una
 * factura que se reserva al mismo tiempo no quede colgando de uno anulado
 * (`verificarFacturable` toma el mismo lock).
 */
export async function anularDocumento(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  return db.transaction(async (tx) => {
    const [doc] = await tx
      .select({ anulado: documentos.anulado })
      .from(documentos)
      .where(eq(documentos.id, id))
      .for("update")
      .limit(1);
    if (!doc || doc.anulado) return { ok: false, error: "Ya estaba anulado, o no existe." };
    if (await facturaViva(tx, id)) {
      return { ok: false, error: "Ya tiene una factura: anulá la factura con su nota de crédito." };
    }
    await tx
      .update(documentos)
      .set({ anulado: true, updatedAt: new Date() })
      .where(eq(documentos.id, id));
    return { ok: true };
  });
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
 * NC. Con una así, el documento se puede volver a facturar. Es el mismo
 * criterio que el índice `comprobantes_documento_vivo_idx`.
 */
const FACTURA_MUERTA = ["rechazado", "error", "anulado"] as const;

/** La factura viva que salió del documento, si hay. El índice garantiza que
 *  hay una como mucho. */
export async function facturaViva(q: Tx | typeof db, documentoId: string) {
  const [f] = await q
    .select({
      id: comprobantes.id,
      letra: comprobantes.letra,
      numero: comprobantes.numeroCompleto,
      estado: comprobantes.estado,
    })
    .from(comprobantes)
    .where(
      and(
        eq(comprobantes.documentoId, documentoId),
        eq(comprobantes.tipo, "factura"),
        notInArray(comprobantes.estado, [...FACTURA_MUERTA]),
      ),
    )
    .limit(1);
  return f ?? null;
}

/**
 * Para un listado: "este documento tiene una factura viva". Con el query
 * builder y no con una plantilla `sql`: en la plantilla drizzle no califica las
 * columnas, y `"id"` dentro de la subconsulta sería el de `comprobantes`.
 */
export const conFacturaViva = sql<boolean>`exists (${db
  .select({ uno: sql`1` })
  .from(comprobantes)
  .where(
    and(
      eq(comprobantes.documentoId, documentos.id),
      eq(comprobantes.tipo, "factura"),
      notInArray(comprobantes.estado, [...FACTURA_MUERTA]),
    ),
  )})`;

export class DocumentoNoFacturable extends Error {}

/**
 * Antes de reservar una factura desde un documento, dentro de la misma
 * transacción: que exista y no esté anulado, con el mismo lock que toma
 * `anularDocumento`. Que no tenga ya otra factura viva lo garantiza el índice
 * al insertar.
 */
export async function verificarFacturable(tx: Tx, documentoId: string) {
  const [doc] = await tx
    .select({ id: documentos.id })
    .from(documentos)
    .where(and(eq(documentos.id, documentoId), eq(documentos.anulado, false)))
    .for("update")
    .limit(1);
  if (!doc) throw new DocumentoNoFacturable();
}
