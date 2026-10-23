import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireFacturacion } from "@/lib/auth";
import {
  mpConfigurado,
  STATE_COOKIE,
  urlAutorizacion,
} from "@/lib/mercadopago/cuenta";

/**
 * Arranca la vinculación de la cuenta de Mercado Pago: manda al usuario a
 * autorizar la app en MP, que después vuelve a `./callback`.
 *
 * El `state` es aleatorio y queda en una cookie httpOnly. Clicnet lo usaba para
 * pasar datos (la sede) y no lo verificaba; acá es la defensa contra que
 * alguien haga que el panel vincule **su** cuenta de MP mandándole al admin un
 * link de callback con un `code` propio.
 */
export async function GET() {
  await requireFacturacion();
  if (!mpConfigurado()) {
    return NextResponse.redirect(
      new URL("/admin/facturacion/cuenta-mp?error=config", process.env.MP_REDIRECT_URI ?? "http://localhost"),
    );
  }

  const state = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(urlAutorizacion(state));
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // `lax` alcanza: la vuelta desde MP es una navegación GET de nivel superior.
    sameSite: "lax",
    path: "/api/mercadopago",
    maxAge: 10 * 60,
  });
  return res;
}
