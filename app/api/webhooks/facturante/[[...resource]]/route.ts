import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { WEBHOOK_TOKEN_HEADER } from "@/lib/facturante/config";
import { procesarWebhookFacturante } from "@/lib/facturacion/webhook";

/**
 * Webhook de Facturante: un comprobante quedó autorizado.
 *
 * Catch-all a propósito: Facturante no postea a la URL que se le pasa sino a
 * `<url>/<resource>`, o sea `/api/webhooks/facturante/ElectronicDocument`
 * (capturado contra el real en Clicnet). `[[...resource]]` acepta las dos.
 *
 * Facturante no firma la notificación, pero reenvía los headers que le pedimos
 * al emitir: viaja un secreto propio. Sin `FACTURANTE_WEBHOOK_SECRET` queda
 * cerrado.
 *
 * A un body que no reconocemos se le contesta 200: un 4xx dispara reintentos
 * de Facturante y no hay nada que reintentar.
 */

function secretoValido(recibido: string | null): boolean {
  const esperado = process.env.FACTURANTE_WEBHOOK_SECRET;
  if (!esperado || !recibido) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!secretoValido(request.headers.get(WEBHOOK_TOKEN_HEADER))) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    console.warn("[facturante-webhook] el body no es JSON");
    return NextResponse.json({ ok: true, ignorado: "body invalido" });
  }

  try {
    const r = await procesarWebhookFacturante(body);
    if (r.estado === "invalido" || r.estado === "desconocido") {
      // El crudo es lo que permite calibrar variantes que todavía no vimos.
      console.warn(`[facturante-webhook] ${r.estado}:`, JSON.stringify(body).slice(0, 2000));
      return NextResponse.json({ ok: true, ignorado: r.estado });
    }
    if (r.estado === "actualizado") revalidatePath("/admin/facturacion", "layout");
    return NextResponse.json({ ok: true, estado: r.estado });
  } catch (e) {
    console.error("[facturante-webhook] error procesando:", e);
    // 500 para que reintente: acá sí puede ser algo transitorio nuestro.
    return NextResponse.json({ error: "error interno" }, { status: 500 });
  }
}
