import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { sincronizarPagos } from "@/lib/mercadopago/sync";
import { renovarUnaCuenta } from "@/lib/mercadopago/cuenta";
import { reconciliarPendientes } from "@/lib/facturacion/reconciliar";

/**
 * Lo que corre una vez por día (lo dispara `scripts/cron-diario.mjs` desde el
 * servicio cron de Railway). Tres tareas, cada una en su `try`: que MP no
 * conteste no tiene por qué frenar la reconciliación de Facturante.
 *
 * Es un route y no un script con acceso a la base porque así corre con el
 * mismo código y el mismo entorno que la app, sin otra copia de las variables.
 */

const DIA = 24 * 60 * 60 * 1000;

function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const recibido = req.headers.get("authorization");
  if (!secret || !recibido) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function paso<T>(nombre: string, fn: () => Promise<T>) {
  try {
    return { ok: true as const, resultado: await fn() };
  } catch (e) {
    console.error(`[cron] ${nombre}:`, e);
    return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function POST(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  const hasta = new Date();
  const sync = await paso("sync", () =>
    sincronizarPagos({ desde: new Date(hasta.getTime() - 7 * DIA), hasta }),
  );
  const reconciliacion = await paso("reconciliar", reconciliarPendientes);
  const token = await paso("token MP", () => renovarUnaCuenta());

  revalidatePath("/admin/facturacion", "layout");

  const ok =
    sync.ok && sync.resultado.fallidas.length === 0 && reconciliacion.ok && token.ok;
  return NextResponse.json({ ok, sync, reconciliacion, token }, { status: ok ? 200 : 500 });
}
