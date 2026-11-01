/**
 * Borra de `movimientos_mp` lo que no es un cobro: los pagos que la cuenta hizo
 * a otros y que el sync guardaba antes de filtrar con `esCobroDe`.
 *
 *   npx tsx scripts/_limpiar-pagos-salientes.ts          → dry-run
 *   APPLY=1 npx tsx scripts/_limpiar-pagos-salientes.ts  → escribe
 *
 * Contra Railway: `railway run -s Postgres -- npx tsx …`, con el TCP proxy.
 *
 * Una fila con comprobante no se toca: si alguien facturó un pago saliente, eso
 * se resuelve anulando la factura, no borrando el movimiento.
 */
import { loadEnvConfig } from "@next/env";
import { esCobroDe, type PagoMp } from "../lib/mercadopago/pagos-map";

// Antes de importar la base: `lib/db` lee DATABASE_URL al cargarse.
loadEnvConfig(process.cwd());
// La DATABASE_URL de `railway run` es la interna, que sólo resuelve dentro de
// Railway: se arma la pública con el proxy.
{
  const { RAILWAY_TCP_PROXY_DOMAIN: host, RAILWAY_TCP_PROXY_PORT: port, PGUSER, PGPASSWORD, PGDATABASE } =
    process.env;
  if (host && port && PGUSER && PGPASSWORD && PGDATABASE) {
    process.env.DATABASE_URL = `postgresql://${encodeURIComponent(PGUSER)}:${encodeURIComponent(PGPASSWORD)}@${host}:${port}/${PGDATABASE}`;
  }
}

async function main() {
  const { eq, inArray, isNotNull } = await import("drizzle-orm");
  const { db } = await import("../lib/db");
  const { comprobantes, cuentasMp, movimientosMp } = await import("../lib/db/schema");

  const aplicar = process.env.APPLY === "1";
  const host = (process.env.DATABASE_URL ?? "").replace(/^.*@/, "").replace(/\/.*$/, "");
  console.log(`Base ${host} · ${aplicar ? "ESCRIBIENDO" : "dry-run (no escribe)"}\n`);

  const filas = await db
    .select({ movimiento: movimientosMp, mpUserId: cuentasMp.mpUserId })
    .from(movimientosMp)
    .innerJoin(cuentasMp, eq(movimientosMp.cuentaId, cuentasMp.id));

  const salientes = filas
    .filter((f) => !esCobroDe(f.movimiento.raw as PagoMp, f.mpUserId))
    .map((f) => f.movimiento);

  const facturados = new Set(
    (
      await db
        .select({ id: comprobantes.movimientoId })
        .from(comprobantes)
        .where(isNotNull(comprobantes.movimientoId))
    ).map((c) => c.id),
  );

  const aBorrar = salientes.filter((m) => !facturados.has(m.id));
  for (const m of salientes) {
    const marca = facturados.has(m.id) ? " · CON COMPROBANTE, no se borra" : "";
    console.log(
      `- ${m.mpPagoId} · ${m.fechaAprobacion.toISOString().slice(0, 10)} · ` +
        `$${(m.montoCentavos / 100).toFixed(2)} · ${m.metodoPago ?? "?"}${marca}`,
    );
  }
  console.log(`\n${filas.length} movimientos, ${salientes.length} salientes, ${aBorrar.length} a borrar.`);

  if (!aplicar) {
    console.log("Dry-run: no se escribió nada. Para aplicarlo: APPLY=1.");
    return;
  }
  if (aBorrar.length === 0) return;

  const borrados = await db
    .delete(movimientosMp)
    .where(inArray(movimientosMp.id, aBorrar.map((m) => m.id)))
    .returning({ id: movimientosMp.id });
  console.log(`Listo: ${borrados.length} borrados.`);
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
