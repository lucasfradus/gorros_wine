import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, ne, notInArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  clientes,
  comprobanteItems,
  comprobantes,
  movimientosMp,
  productos,
  type FormaPago,
} from "@/lib/db/schema";
import { normalizeEmail } from "@/lib/auth/password";
import { configFacturante } from "@/lib/facturante/config";
import {
  mapFactura,
  mapNotaCredito,
  numeroDeComprobante,
  prefijoDeComprobante,
  type ReceptorFiscal,
} from "@/lib/facturante/mappers";
import type { DocumentoResponse, ElectronicDocument } from "@/lib/facturante/types";
import { hoyEnArgentina } from "@/lib/format";
import { calcular, validarRenglones, type Renglon } from "./calculo";
import { camposACompletar, datosDeReceptor } from "./cliente-receptor";
import { rangoDeFecha, validarFecha, validarReceptor, type DatosReceptor } from "./reglas";

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

/** El único renglón de la factura de un cobro de MP: su descripción, o una
 *  genérica. La vista previa muestra esto mismo. */
export const descripcionDelCobro = (mov: { descripcion: string | null }) =>
  (mov.descripcion?.trim() || DESCRIPCION_POR_DEFECTO).slice(0, 200);

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** ¿Ese mail ya es de otro cliente? `email` es UNIQUE en `clientes`. */
async function mailDeOtro(tx: Tx, email: string, exceptoId?: string) {
  const [otro] = await tx
    .select({ id: clientes.id })
    .from(clientes)
    .where(and(eq(clientes.email, email), exceptoId ? ne(clientes.id, exceptoId) : undefined))
    .limit(1);
  return !!otro;
}

/**
 * A qué cliente queda asociada la factura (las reglas, en
 * `cliente-receptor.ts`). El elegido en pantalla; si no hay, el que ya tiene
 * ese CUIT o DNI, aunque se haya pedido crear uno; si tampoco, uno nuevo, sólo
 * si se pidió. Al que ya existía se le completan los campos vacíos.
 *
 * Va dentro de la transacción del comprobante: si la factura no se reserva,
 * tampoco queda un cliente a medio crear.
 */
export async function resolverCliente(
  tx: Tx,
  o: { clienteId: string | null; guardar: boolean; receptor: ReceptorFiscal; percepcionIva: boolean },
): Promise<string | null> {
  const datos = datosDeReceptor(o.receptor, o.percepcionIva);
  if (datos?.email) datos.email = normalizeEmail(datos.email);

  let [cliente] = o.clienteId
    ? await tx.select().from(clientes).where(eq(clientes.id, o.clienteId)).limit(1)
    : [];
  if (!cliente && o.receptor.docNumero) {
    // Se compara por dígitos: el documento de `clientes` es texto libre y
    // puede estar cargado con guiones o puntos.
    [cliente] = await tx
      .select()
      .from(clientes)
      .where(sql`regexp_replace(${clientes.documento}, '[^0-9]', '', 'g') = ${o.receptor.docNumero}`)
      .orderBy(desc(clientes.isActive), asc(clientes.createdAt))
      .limit(1);
  }

  if (cliente) {
    const cambios = datos
      ? camposACompletar(cliente, datos)
      : cliente.condicionIva === null
        ? { condicionIva: o.receptor.condicionIva }
        : {};
    if (cambios.email && (await mailDeOtro(tx, cambios.email, cliente.id))) delete cambios.email;
    if (Object.keys(cambios).length) {
      const id = cliente.id;
      await sinChoqueDeMail(tx, (sp, conMail) =>
        sp
          .update(clientes)
          .set({ ...cambios, ...(conMail ? {} : { email: undefined }), updatedAt: new Date() })
          .where(eq(clientes.id, id)),
      );
    }
    return cliente.id;
  }

  if (!o.guardar || !datos) return null;
  // Con el mail de otro cliente, se crea sin mail: la factura lo lleva igual.
  const email = datos.email && !(await mailDeOtro(tx, datos.email)) ? datos.email : null;
  const [creado] = await sinChoqueDeMail(tx, (sp, conMail) =>
    sp
      .insert(clientes)
      .values({ ...datos, email: conMail ? email : null })
      .returning({ id: clientes.id }),
  );
  return creado.id;
}

/**
 * Escribe en `clientes` dentro de un savepoint. `mailDeOtro` ya descarta el
 * mail ocupado, pero otra escritura simultánea con el mismo mail puede ganar
 * entre la consulta y el insert: entonces se reintenta sin mail. Sin esto, el
 * 23505 de `clientes` subía al catch de `reservar` y se leía "esa factura ya se
 * mandó", con la factura sin emitir.
 */
async function sinChoqueDeMail<T>(tx: Tx, escribir: (sp: Tx, conMail: boolean) => Promise<T>) {
  try {
    return await tx.transaction((sp) => escribir(sp, true));
  } catch (e) {
    if (!esDuplicado(e)) throw e;
    return tx.transaction((sp) => escribir(sp, false));
  }
}

/**
 * La fecha de la última factura de cada letra que cuenta para la
 * correlatividad de ARCA: las que salieron o pueden salir. Las rechazadas y
 * las que nunca se mandaron no ocupan lugar. Hay un solo punto de venta.
 */
export async function ultimasFechas(): Promise<Record<"A" | "B", string | null>> {
  const filas = await db
    .select({ letra: comprobantes.letra, ultima: sql<string>`max(${comprobantes.fecha})::text` })
    .from(comprobantes)
    .where(and(eq(comprobantes.tipo, "factura"), notInArray(comprobantes.estado, ["rechazado", "error"])))
    .groupBy(comprobantes.letra);
  const de = (l: "A" | "B") => filas.find((f) => f.letra === l)?.ultima ?? null;
  return { A: de("A"), B: de("B") };
}

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
  guardarCliente: boolean;
  /** "AAAA-MM-DD"; `null` es hoy. */
  dia: string | null;
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

  // En hora de Argentina: en UTC, después de las 21 sería "mañana", y eso
  // choca con la correlatividad de ARCA.
  const hoy = hoyEnArgentina();
  const dia = o.dia ?? hoy;
  const errorFecha = validarFecha(dia, rangoDeFecha(hoy, (await ultimasFechas())[v.letra]));
  if (errorFecha) return { ok: false, error: errorFecha };

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
    dia,
    externalId,
    posId: cfg.posId,
  });

  try {
    await db.transaction(async (tx) => {
      const clienteId = await resolverCliente(tx, {
        clienteId: o.clienteId,
        guardar: o.guardarCliente,
        receptor: v.receptor,
        percepcionIva: o.percepcionIva,
      });
      await tx.insert(comprobantes).values({
        id: o.id,
        movimientoId: o.movimientoId,
        tipo: "factura",
        letra: v.letra,
        estado: "pendiente",
        fecha: dia,
        externalId,
        totalCentavos: calc.totalCentavos,
        formaPago: o.formaPago,
        tributos: calc.percepciones.length ? calc.percepciones : null,
        receptorDocTipo: v.receptor.docTipo,
        receptorDocNumero: v.receptor.docNumero ?? "0",
        receptorNombre: v.receptor.nombre,
        receptorCondicionIva: v.receptor.condicionIva,
        clienteId,
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

  return { ok: true, comprobanteId: o.id };
}

/** La factura de un cobro de MP: un único renglón por el total, sin percepción. */
export async function reservarFactura(opts: {
  movimientoId: string;
  datos: DatosReceptor;
  clienteId: string | null;
  guardarCliente: boolean;
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
        descripcion: descripcionDelCobro(mov),
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
    guardarCliente: opts.guardarCliente,
    // La de un cobro sale con la fecha del día: el cobro ya tiene la suya.
    dia: null,
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
  guardarCliente: boolean;
  /** "AAAA-MM-DD", elegida en pantalla dentro de `rangoDeFecha`. */
  dia: string;
  actorId: string;
}): Promise<Reserva> {
  return reservar({
    ...opts,
    movimientoId: null,
    siDuplicado: "Esa factura ya se mandó: buscala en Facturación.",
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
  // La NC sale con la fecha de hoy: nunca anterior a la de su factura, que como
  // mucho es de hoy (`rangoDeFecha`).
  const hoy = hoyEnArgentina();
  const request = mapNotaCredito(
    facturaRequest,
    { posId: cfg.posId, posPrefix: prefijo, number: numero, cuitEmisor: cfg.emisorCuit, fecha },
    { dia: hoy, externalId },
  );

  try {
    await db.transaction(async (tx) => {
      await tx.insert(comprobantes).values({
        id,
        movimientoId: f.movimientoId,
        tipo: "nota_credito",
        letra: f.letra,
        estado: "pendiente",
        fecha: hoy,
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
