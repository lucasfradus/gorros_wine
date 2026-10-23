import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireFacturacion } from "@/lib/auth";
import { STATE_COOKIE, vincularCuenta } from "@/lib/mercadopago/cuenta";

/**
 * Vuelta del OAuth de Mercado Pago: valida el `state`, cambia el `code` por
 * tokens y guarda la cuenta.
 *
 * Se vuelve a pedir `requireFacturacion()` aunque el inicio ya lo hizo: el
 * callback es una URL pública y cualquiera puede pegarle.
 */
export async function GET(request: NextRequest) {
  const user = await requireFacturacion();

  // Las redirecciones salen del origen de la redirect URI y no de
  // `request.url`: detrás del proxy de Railway, `request.url` puede traer el
  // host interno.
  const base = new URL(process.env.MP_REDIRECT_URI ?? request.url).origin;
  const volver = (q: string) => {
    const res = NextResponse.redirect(new URL(`/admin/facturacion/cuenta-mp?${q}`, base));
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/mercadopago" });
    return res;
  };

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const esperado = request.cookies.get(STATE_COOKIE)?.value;

  if (!code || !state || !esperado || !mismoTexto(state, esperado)) {
    return volver("error=state");
  }

  try {
    await vincularCuenta(code, user.id);
  } catch (e) {
    console.error("[mercadopago] no se pudo vincular la cuenta:", e);
    return volver("error=oauth");
  }
  return volver("ok=vinculada");
}

function mismoTexto(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
