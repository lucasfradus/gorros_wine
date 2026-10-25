/**
 * Asocia a un cliente las facturas emitidas antes de que la factura guardara
 * clientes: las que tienen receptor con nombre y `cliente_id` vacío. Usa la
 * misma regla que la emisión (`resolverCliente`): el cliente que ya tiene ese
 * CUIT/DNI, o uno nuevo con los datos del receptor. Sus notas de crédito quedan
 * asociadas al mismo cliente.
 *
 * Las de "Consumidor final" sin nombre no se tocan: no hay a quién asociarlas.
 *
 *   npx tsx scripts/_backfill-clientes-facturas.ts          → dry-run
 *   APPLY=1 npx tsx scripts/_backfill-clientes-facturas.ts  → escribe
 *
 * El dry-run hace todo dentro de una transacción y la deshace al final: lo que
 * imprime es exactamente lo que haría.
 */
import { loadEnvConfig } from "@next/env";
import type { CondicionIva } from "../lib/db/schema";
import type { ReceptorFiscal } from "../lib/facturante/mappers";
import type { ElectronicDocument } from "../lib/facturante/types";

// Antes de importar la base: `lib/db` lee DATABASE_URL al cargarse.
loadEnvConfig(process.cwd());

class Deshacer extends Error {}

/** El receptor como lo armó la factura: columnas, más mail y domicilio del request. */
function receptorDe(c: {
  receptorDocTipo: string;
  receptorDocNumero: string;
  receptorNombre: string | null;
  receptorCondicionIva: CondicionIva;
  requestPayload: unknown;
}): ReceptorFiscal {
  const header = (c.requestPayload as ElectronicDocument | null)?.header;
  const address = header?.address;
  return {
    condicionIva: c.receptorCondicionIva,
    docTipo: c.receptorDocTipo as ReceptorFiscal["docTipo"],
    docNumero: c.receptorDocTipo === "ninguno" ? null : c.receptorDocNumero,
    nombre: c.receptorNombre,
    email: header?.receiver?.mails?.[0]?.mail ?? null,
    domicilio:
      address?.street && address.state
        ? { calle: address.street, ciudad: address.city ?? null, provincia: address.state }
        : null,
  };
}

async function main() {
  const { and, eq, inArray, isNotNull, isNull, or } = await import("drizzle-orm");
  const { db } = await import("../lib/db");
  const { clientes, comprobantes } = await import("../lib/db/schema");
  const { resolverCliente } = await import("../lib/facturacion/emitir");

  const aplicar = process.env.APPLY === "1";
  const host = (process.env.DATABASE_URL ?? "").replace(/^.*@/, "").replace(/\/.*$/, "");
  console.log(`Base ${host} · ${aplicar ? "ESCRIBIENDO" : "dry-run (no escribe)"}\n`);

  const facturas = await db
    .select()
    .from(comprobantes)
    .where(
      and(
        eq(comprobantes.tipo, "factura"),
        isNull(comprobantes.clienteId),
        isNotNull(comprobantes.receptorNombre),
        // Sólo las que existen para ARCA: una rechazada o no enviada no es una venta.
        inArray(comprobantes.estado, ["autorizado", "anulado"]),
      ),
    )
    .orderBy(comprobantes.createdAt);

  if (facturas.length === 0) {
    console.log("No hay facturas con receptor y sin cliente. Nada que hacer.");
    return;
  }

  try {
    await db.transaction(async (tx) => {
      for (const f of facturas) {
        const receptor = receptorDe(f);
        const clienteId = await resolverCliente(tx, {
          clienteId: null,
          guardar: true,
          receptor,
          percepcionIva: (f.tributos?.length ?? 0) > 0,
        });
        if (!clienteId) {
          console.log(`- ${f.numeroCompleto} · ${f.receptorNombre}: sin nombre, queda sin cliente`);
          continue;
        }
        const [cli] = await tx
          .select({ nombre: clientes.nombre, createdAt: clientes.createdAt })
          .from(clientes)
          .where(eq(clientes.id, clienteId));
        const nuevo = Date.now() - cli.createdAt.getTime() < 60_000;
        const asociados = await tx
          .update(comprobantes)
          .set({ clienteId, updatedAt: new Date() })
          .where(or(eq(comprobantes.id, f.id), eq(comprobantes.origenId, f.id)))
          .returning({ numero: comprobantes.numeroCompleto });
        console.log(
          `- ${f.numeroCompleto} · ${f.receptorNombre} · ${f.receptorDocTipo.toUpperCase()} ${f.receptorDocNumero}\n` +
            `    → ${nuevo ? "cliente NUEVO" : "cliente existente"} "${cli.nombre}"` +
            `${receptor.email ? ` · mail ${receptor.email}` : ""}` +
            `${receptor.domicilio ? ` · ${receptor.domicilio.calle}, ${receptor.domicilio.provincia}` : ""}\n` +
            `    → asocia ${asociados.map((a) => a.numero ?? "(sin número)").join(", ")}`,
        );
      }
      if (!aplicar) throw new Deshacer();
    });
    console.log(`\nListo: ${facturas.length} factura(s) procesadas.`);
  } catch (e) {
    if (!(e instanceof Deshacer)) throw e;
    console.log("\nDry-run: no se escribió nada. Para aplicarlo: APPLY=1.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { db } = await import("../lib/db");
    await db.$client.end();
  });
