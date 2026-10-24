import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  clientes,
  comprobanteItems,
  comprobantes,
  movimientosMp,
  productos,
  type FormaPago,
} from "@/lib/db/schema";
import { configFacturante } from "@/lib/facturante/config";
import {
  mapFactura,
  mapNotaCredito,
  numeroDeComprobante,
  prefijoDeComprobante,
} from "@/lib/facturante/mappers";
import type { DocumentoResponse, ElectronicDocument } from "@/lib/facturante/types";
import { hoyEnArgentina } from "@/lib/format";
import { calcular, validarRenglones, type Renglon } from "./calculo";
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

/**
 * Lo común a una factura de cobro y a una manual: validar, calcular, armar el
 * request y escribir comprobante + renglones juntos. Lo que cambia entre las
 * dos es de dónde salen los renglones y qué decir si choca un duplicado.
 */
async function reservar(o: {
  id: string;
  movimientoId: string | null;
  renglones: Renglon[];
  percepcionIva: boolean;
  formaPago: FormaPago;
  datos: DatosReceptor;
  clienteId: string | null;
  actorId: string;
  siDuplicado: string;
}): Promise<Reserva> {
  const cfg = configFacturante();
  if (!cfg) return { ok: false, error: "Falta la configuración de Facturante en el entorno." };

  const errorRenglones = validarRenglones(o.renglones);
  if (errorRenglones) return { ok: false, error: errorRenglones };

  // La RG 5329 sólo alcanza a un responsable inscripto: a cualquier otro se
  // ignora la casilla en vez de rechazar la factura por ella.
  const calc = calcular(o.renglones, {
    percepcionIva: o.percepcionIva && o.datos.condicionIva === "responsable_inscripto",
  });
  const v = validarReceptor(o.datos, calc.totalCentavos);
  if (!v.ok) return v;

  if (o.clienteId) {
    const [cli] = await db
      .select({ id: clientes.id })
      .from(clientes)
      .where(eq(clientes.id, o.clienteId))
      .limit(1);
    if (!cli) return { ok: false, error: "No se encontró el cliente." };
  }

  // Un producto archivado se puede facturar (se archiva, no se borra), pero uno
  // que no existe rompería la FK con un error ilegible.
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

  const externalId = `gorros-f-${o.id}`;
  const request = mapFactura({
    letra: v.letra,
    receptor: v.receptor,
    renglones: o.renglones,
    percepciones: calc.percepciones,
    formaPago: o.formaPago,
    // En hora de Argentina: en UTC, después de las 21 sería "mañana", y con
    // facturas manuales del día eso choca con 100014.
    dia: hoyEnArgentina(),
    externalId,
    posId: cfg.posId,
  });

  try {
    await db.transaction(async (tx) => {
      await tx.insert(comprobantes).values({
        id: o.id,
        movimientoId: o.movimientoId,
        tipo: "factura",
        letra: v.letra,
        estado: "pendiente",
        externalId,
        totalCentavos: calc.totalCentavos,
        formaPago: o.formaPago,
        tributos: calc.percepciones.length ? calc.percepciones : null,
        receptorDocTipo: v.receptor.docTipo,
        receptorDocNumero: v.receptor.docNumero ?? "0",
        receptorNombre: v.receptor.nombre,
        receptorCondicionIva: v.receptor.condicionIva,
        clienteId: o.clienteId,
        requestPayload: request,
        emitidoPor: o.actorId,
      });
      await tx.insert(comprobanteItems).values(
        calc.renglones.map((r, i) => ({
          comprobanteId: o.id,
          productoId: r.productoId,
          orden: i,
          descripcion: r.descripcion,
          cantidad: r.cantidad,
          precioUnitarioCentavos: r.precioUnitarioCentavos,
          descuentoPct: r.descuentoPct,
          subtotalCentavos: r.subtotalCentavos,
          alcanzado: r.alcanzado,
        })),
      );
    });
  } catch (e) {
    if (esDuplicado(e)) return { ok: false, error: o.siDuplicado };
    throw e;
  }

  // Al cliente que todavía no tenía condición frente al IVA se le guarda la
  // que se usó, así la próxima vez sale precargada. Lo que ya tenía no se pisa.
  if (o.clienteId) {
    await db
      .update(clientes)
      .set({ condicionIva: v.receptor.condicionIva, updatedAt: new Date() })
      .where(and(eq(clientes.id, o.clienteId), isNull(clientes.condicionIva)));
  }

  return { ok: true, comprobanteId: o.id };
}

/** La factura de un cobro de MP: un único renglón por el total, sin percepción. */
export async function reservarFactura(opts: {
  movimientoId: string;
  datos: DatosReceptor;
  clienteId: string | null;
  actorId: string;
}): Promise<Reserva> {
  const [mov] = await db
    .select()
    .from(movimientosMp)
    .where(eq(movimientosMp.id, opts.movimientoId))
    .limit(1);
  if (!mov) return { ok: false, error: "No se encontró el cobro." };
  if (mov.montoCentavos <= 0) return { ok: false, error: "El cobro no tiene importe." };

  return reservar({
    id: randomUUID(),
    movimientoId: mov.id,
    renglones: [
      {
        productoId: null,
        descripcion: (mov.descripcion?.trim() || DESCRIPCION_POR_DEFECTO).slice(0, 200),
        cantidad: 1,
        precioUnitarioCentavos: mov.montoCentavos,
        descuentoPct: 0,
        alcanzado: false,
      },
    ],
    percepcionIva: false,
    formaPago: "electronico",
    datos: opts.datos,
    clienteId: opts.clienteId,
    actorId: opts.actorId,
    siDuplicado: "Ese cobro ya tiene una factura, o se está emitiendo.",
  });
}

/**
 * Una factura sin cobro de MP detrás. El `id` lo trae el formulario, generado
 * al dibujarlo: un segundo envío del mismo formulario choca con la PK en vez
 * de sacar otra factura (Facturante no deduplica).
 */
export async function reservarFacturaManual(opts: {
  id: string;
  renglones: Renglon[];
  percepcionIva: boolean;
  formaPago: FormaPago;
  datos: DatosReceptor;
  clienteId: string | null;
  actorId: string;
}): Promise<Reserva> {
  return reservar({
    ...opts,
    movimientoId: null,
    siDuplicado: "Esa factura ya se mandó: buscala en Comprobantes.",
  });
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
    await db.transaction(async (tx) => {
      await tx.insert(comprobantes).values({
        id,
        movimientoId: f.movimientoId,
        tipo: "nota_credito",
        letra: f.letra,
        estado: "pendiente",
        externalId,
        totalCentavos: f.totalCentavos,
        formaPago: f.formaPago,
        tributos: f.tributos,
        receptorDocTipo: f.receptorDocTipo,
        receptorDocNumero: f.receptorDocNumero,
        receptorNombre: f.receptorNombre,
        receptorCondicionIva: f.receptorCondicionIva,
        clienteId: f.clienteId,
        origenId: f.id,
        requestPayload: request,
        emitidoPor: opts.actorId,
      });
      // La NC devuelve lo mismo que facturó la factura: sus mismos renglones.
      const items = await tx
        .select()
        .from(comprobanteItems)
        .where(eq(comprobanteItems.comprobanteId, f.id));
      if (items.length) {
        await tx
          .insert(comprobanteItems)
          .values(items.map(({ id: _id, ...it }) => ({ ...it, comprobanteId: id })));
      }
    });
  } catch (e) {
    if (esDuplicado(e)) {
      return { ok: false, error: "Esa factura ya tiene una nota de crédito en camino." };
    }
    throw e;
  }

  return { ok: true, comprobanteId: id };
}
