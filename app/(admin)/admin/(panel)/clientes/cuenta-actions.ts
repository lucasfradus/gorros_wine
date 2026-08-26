"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { clientes, movimientosCc, type NewMovimientoCc } from "@/lib/db/schema";
import { requireCuentaCorriente } from "@/lib/auth";
import { hoyEnArgentina } from "@/lib/format";
import {
  aDeltas,
  conSigno,
  importeACentavos,
  MONEDAS,
  patasDeConversion,
  type Moneda,
} from "@/lib/cuenta-corriente";

export interface CuentaFormState {
  error?: string;
  ok?: string;
}

/**
 * Los movimientos de la cuenta corriente.
 *
 * Archivo aparte de `actions.ts` porque todo lo de acá exige
 * `requireCuentaCorriente()`: un editor edita la ficha del cliente, pero no
 * toca un peso. Teniéndolo separado no hay forma de agregar una acción de
 * plata detrás del permiso equivocado por distracción.
 *
 * Una sola action con un `tipo` adentro, y no cuatro: la autorización, la
 * fecha, los importes y el revalidate son idénticos para todas, y el
 * formulario necesita un único `useActionState`. Lo que cambia por tipo son
 * las filas que se escriben, y eso es el `switch` del final.
 */

/**
 * La fecha del hecho, desde un `<input type="date">`.
 *
 * Se guarda al mediodía UTC y no a medianoche: en Buenos Aires (UTC−3) las
 * cero horas caen en el día anterior, y el movimiento cargado el 12 aparecería
 * fechado el 11 en el extracto.
 */
function fechaDelHecho(valor: FormDataEntryValue | null): Date | "invalida" {
  const texto = typeof valor === "string" ? valor.trim() : "";
  if (texto === "") return new Date();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return "invalida";
  if (texto > hoyEnArgentina()) return "invalida";

  const fecha = new Date(`${texto}T12:00:00Z`);
  return Number.isNaN(fecha.getTime()) ? "invalida" : fecha;
}

/** Un importe obligatorio y positivo, en centavos. */
function montoPositivo(valor: FormDataEntryValue | null): number | null {
  const texto = typeof valor === "string" ? valor : "";
  const centavos = importeACentavos(texto);
  return centavos !== null && centavos > 0 ? centavos : null;
}

const monedaSchema = z.enum(MONEDAS);

/**
 * El tipo de cambio que arreglaron, en pesos por dólar.
 *
 * Se lee con el mismo parser que los importes —así "1.200" y "1200" valen
 * igual, que es como lo va a tipear cualquiera— y por eso vuelve en centavos:
 * dividir por cien lo devuelve a pesos. Quedan dos decimales de precisión,
 * de sobra para una cotización.
 */
function cotizacionPactada(valor: FormDataEntryValue | null): number | null {
  const centavos = importeACentavos(String(valor ?? ""));
  if (centavos === null || centavos <= 0) return null;
  return centavos / 100;
}

// ------------------------------------------------------------- registrar

export async function registrarMovimientoAction(
  _prev: CuentaFormState,
  formData: FormData,
): Promise<CuentaFormState> {
  const actor = await requireCuentaCorriente();

  const clienteId = z.uuid().safeParse(formData.get("clienteId"));
  if (!clienteId.success) return { error: "Cliente inválido." };

  const tipo = z
    .enum(["cargo", "pago", "conversion", "ajuste"])
    .safeParse(formData.get("tipo"));
  if (!tipo.success) return { error: "Elegí qué clase de movimiento es." };

  const [cliente] = await db
    .select({ id: clientes.id })
    .from(clientes)
    .where(eq(clientes.id, clienteId.data))
    .limit(1);
  if (!cliente) return { error: "Ese cliente ya no existe." };

  const fecha = fechaDelHecho(formData.get("fecha"));
  if (fecha === "invalida") {
    return { error: "Revisá la fecha: tiene que ser de hoy o anterior." };
  }

  const detalle = String(formData.get("detalle") ?? "").trim();
  if (detalle.length < 2) {
    return { error: "Escribí un detalle: dentro de un mes nadie se acuerda." };
  }
  if (detalle.length > 300) return { error: "El detalle es muy largo." };

  const monto = montoPositivo(formData.get("monto"));
  if (monto === null) {
    return { error: "Revisá el importe: tiene que ser un número mayor a cero." };
  }

  const moneda = monedaSchema.safeParse(formData.get("moneda"));
  if (!moneda.success) return { error: "Elegí la moneda." };

  const grupoId = crypto.randomUUID();
  const comun = { clienteId: cliente.id, fecha, grupoId, creadoPor: actor.id };
  const filas: NewMovimientoCc[] = [];

  switch (tipo.data) {
    case "cargo": {
      filas.push({
        ...comun,
        tipo: "cargo",
        detalle,
        ...aDeltas(conSigno(monto, moneda.data, false)),
      });
      break;
    }

    case "pago": {
      // La entrega de plata se anota siempre, tal como pasó. Aplicarla contra
      // la deuda de la otra moneda es una decisión aparte, y por eso es una
      // fila aparte: el mismo pago podría haberse quedado como saldo a favor.
      filas.push({
        ...comun,
        tipo: "pago",
        detalle,
        ...aDeltas(conSigno(monto, moneda.data, true)),
      });

      if (formData.get("aplicar") === "on") {
        const tc = cotizacionPactada(formData.get("cotizacion"));
        if (tc === null) {
          return {
            error:
              "Para aplicar el pago a la otra moneda hace falta el tipo de cambio que arreglaron.",
          };
        }
        const otra: Moneda = moneda.data === "USD" ? "ARS" : "USD";

        filas.push({
          ...comun,
          tipo: "conversion",
          detalle: `Aplicado a la cuenta en ${otra === "ARS" ? "pesos" : "dólares"}`,
          cotizacion: tc.toFixed(4),
          ...aDeltas(patasDeConversion(monto, moneda.data, tc)),
        });
      }
      break;
    }

    case "conversion": {
      const tc = cotizacionPactada(formData.get("cotizacion"));
      if (tc === null) {
        return { error: "Escribí el tipo de cambio que arreglaron." };
      }

      filas.push({
        ...comun,
        tipo: "conversion",
        detalle,
        cotizacion: tc.toFixed(4),
        ...aDeltas(patasDeConversion(monto, moneda.data, tc)),
      });
      break;
    }

    case "ajuste": {
      const aFavor = formData.get("sentido") === "favor";
      filas.push({
        ...comun,
        tipo: "ajuste",
        detalle,
        ...aDeltas(conSigno(monto, moneda.data, aFavor)),
      });
      break;
    }
  }

  await db.insert(movimientosCc).values(filas);

  revalidatePath("/admin/clientes");
  revalidatePath(`/admin/clientes/${cliente.id}`);
  return { ok: "Movimiento registrado." };
}

// ---------------------------------------------------------------- anular

/**
 * Anula una operación entera agregando la inversa.
 *
 * No hay `UPDATE` ni `DELETE`: el movimiento original queda donde estaba y el
 * saldo se corrige solo, porque la suma de una fila y su opuesta es cero. Lo
 * que se ve tachado en el extracto es una decisión de pantalla, no de datos.
 *
 * Se anula el **grupo** y nunca una fila suelta: si un pago en dólares se
 * aplicó a la deuda en pesos son dos filas, y dejar una viva desbalancearía la
 * cuenta entre las dos monedas.
 */
export async function anularOperacionAction(
  _prev: CuentaFormState,
  formData: FormData,
): Promise<CuentaFormState> {
  const actor = await requireCuentaCorriente();

  const grupoId = z.uuid().safeParse(formData.get("grupoId"));
  if (!grupoId.success) return { error: "Operación inválida." };

  const original = await db
    .select()
    .from(movimientosCc)
    .where(eq(movimientosCc.grupoId, grupoId.data));

  if (original.length === 0) return { error: "Esa operación ya no existe." };

  const [yaAnulada] = await db
    .select({ id: movimientosCc.id })
    .from(movimientosCc)
    .where(eq(movimientosCc.anulaGrupoId, grupoId.data))
    .limit(1);

  if (yaAnulada) return { error: "Esa operación ya estaba anulada." };

  // Anular una anulación volvería a aplicar el movimiento original por la
  // puerta de atrás, y el extracto pasaría a ser ilegible.
  if (original.some((m) => m.anulaGrupoId !== null)) {
    return {
      error:
        "Esto ya es la anulación de otra operación. Si hace falta revertirla, cargá el movimiento de nuevo.",
    };
  }

  const clienteId = original[0].clienteId;
  const nuevoGrupo = crypto.randomUUID();

  await db.insert(movimientosCc).values(
    original.map((m) => ({
      clienteId,
      // La anulación se fecha hoy, no el día del original: es un hecho nuevo.
      fecha: new Date(),
      tipo: m.tipo,
      detalle: `Anulación de: ${m.detalle}`,
      deltaArsCentavos: -m.deltaArsCentavos,
      deltaUsdCentavos: -m.deltaUsdCentavos,
      cotizacion: m.cotizacion,
      grupoId: nuevoGrupo,
      anulaGrupoId: m.grupoId,
      creadoPor: actor.id,
    })),
  );

  revalidatePath("/admin/clientes");
  revalidatePath(`/admin/clientes/${clienteId}`);
  return { ok: "Operación anulada." };
}
