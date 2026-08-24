import { NextResponse, type NextRequest } from "next/server";

/**
 * Redirección temprana, no control de acceso.
 *
 * El middleware corre en el runtime Edge y no puede consultar Postgres, así
 * que acá sólo se mira si *existe* la cookie: alcanza para mandar a la
 * pantalla de ingreso sin renderizar el panel. Quién es cada uno y qué puede
 * hacer se decide siempre contra la base, en `requireUser()`.
 *
 * `/admin/login` queda fuera a propósito. Si el middleware sacara de ahí a
 * todo el que trae cookie, una cookie vencida entraría en un rebote infinito
 * entre el panel y el ingreso. Esa decisión la toma la propia página, que sí
 * puede validar contra la base.
 */
const SESSION_COOKIE = "gw_session";

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (pathname === "/admin/login") return NextResponse.next();
  if (req.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const url = new URL("/admin/login", req.url);
  url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*"],
};
