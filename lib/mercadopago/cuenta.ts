import { and, asc, eq, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { cuentasMp, type CuentaMp } from "@/lib/db/schema";
import { cifrarToken, descifrarToken } from "@/lib/crypto/tokens";

/**
 * La cuenta de Mercado Pago del local: vincularla por OAuth, leer su token y
 * renovarlo antes de que venza.
 *
 * Portado de Clicnet (`api/mercadopago/*` y `renovar-token.ts`). Dos cosas
 * cambian: el intercambio del código va con `fetch` y no con el SDK —el SDK
 * sólo envolvía este mismo POST y obligaba a tener un access token de la app
 * que no se usa para nada más—, y no hay sedes: el local es uno.
 */

const OAUTH_URL = "https://api.mercadopago.com/oauth/token";

/** Cookie del `state` del OAuth. Vive acá porque un `route.ts` de Next sólo
 *  puede exportar los métodos HTTP. */
export const STATE_COOKIE = "mp_oauth_state";

export function mpConfigurado(): boolean {
  return Boolean(
    process.env.MP_APP_ID &&
      process.env.MP_CLIENT_SECRET &&
      process.env.MP_REDIRECT_URI &&
      process.env.MP_TOKEN_ENCRYPTION_KEY,
  );
}

export function urlAutorizacion(state: string): string {
  const qs = new URLSearchParams({
    client_id: process.env.MP_APP_ID ?? "",
    response_type: "code",
    platform_id: "mp",
    state,
    redirect_uri: process.env.MP_REDIRECT_URI ?? "",
  });
  return `https://auth.mercadopago.com.ar/authorization?${qs}`;
}

interface RespuestaOAuth {
  access_token?: string;
  refresh_token?: string;
  user_id?: number | string;
  public_key?: string;
  expires_in?: number;
  message?: string;
  error?: string;
}

async function pedirToken(body: Record<string, string>): Promise<RespuestaOAuth> {
  const res = await fetch(OAUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: process.env.MP_APP_ID,
      client_secret: process.env.MP_CLIENT_SECRET,
      ...body,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json().catch(() => null)) as RespuestaOAuth | null;
  if (!res.ok || !json?.access_token) {
    const detalle = json?.message ?? json?.error ?? "sin detalle";
    throw new Error(`MP oauth/token HTTP ${res.status}: ${detalle}`);
  }
  return json;
}

const vencimiento = (expiresIn?: number) =>
  // MP los emite por 180 días. Si algún día no informa el plazo, se asume ése
  // en vez de dejar la cuenta sin fecha y fuera de la cola de renovación.
  new Date(Date.now() + (expiresIn ?? 180 * 24 * 60 * 60) * 1000);

/**
 * Cambia el `code` del callback por tokens y guarda la cuenta. Si ya estaba
 * vinculada (mismo `user_id` de MP), le pisa los tokens y la reactiva: volver a
 * vincular es la forma de arreglar una cuenta con el token muerto.
 */
export async function vincularCuenta(code: string, actorId: string): Promise<CuentaMp> {
  const t = await pedirToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.MP_REDIRECT_URI ?? "",
  });
  if (!t.refresh_token || t.user_id == null) {
    throw new Error("MP no devolvió refresh_token o user_id");
  }

  const datos = {
    accessTokenCifrado: cifrarToken(t.access_token!),
    refreshTokenCifrado: cifrarToken(t.refresh_token),
    publicKey: t.public_key ?? null,
    expiresAt: vencimiento(t.expires_in),
    isActive: true,
    vinculadaPor: actorId,
    updatedAt: new Date(),
  };

  const [cuenta] = await db
    .insert(cuentasMp)
    .values({ alias: `MP ${t.user_id}`, mpUserId: String(t.user_id), ...datos })
    .onConflictDoUpdate({ target: cuentasMp.mpUserId, set: datos })
    .returning();
  return cuenta;
}

/** El access token en claro. **No renueva**: ver `renovarUnaCuenta`. */
export function tokenDe(cuenta: Pick<CuentaMp, "accessTokenCifrado">): string {
  return descifrarToken(cuenta.accessTokenCifrado);
}

/** Días antes del vencimiento en que una cuenta entra en la cola de renovación. */
const MARGEN_DIAS = 30;

/**
 * Renueva **una** cuenta: la activa que vence primero entre las que vencen en
 * los próximos 30 días. La llama el cron, una vez por día.
 *
 * Una sola y nunca en ráfaga, por lo que pasó en Clicnet el 14-oct-2026: el
 * cron renovó tres cuentas en un segundo, MP respondió 429 a las tres **y aun
 * así invalidó sus access tokens vigentes**. El refresh token, en cambio,
 * sobrevivió. Por eso, si esto falla, la cuenta queda primera en la cola y se
 * reintenta mañana con el mismo refresh token. Ningún otro camino renueva:
 * varios requests concurrentes con el token vencido son justo esa ráfaga.
 */
export async function renovarUnaCuenta(ahora = new Date()) {
  const limite = new Date(ahora.getTime() + MARGEN_DIAS * 24 * 60 * 60 * 1000);
  const [turno] = await db
    .select()
    .from(cuentasMp)
    .where(and(eq(cuentasMp.isActive, true), lt(cuentasMp.expiresAt, limite)))
    .orderBy(asc(cuentasMp.expiresAt))
    .limit(1);
  if (!turno) return { renovada: null };

  const t = await pedirToken({
    grant_type: "refresh_token",
    refresh_token: descifrarToken(turno.refreshTokenCifrado),
  });

  // MP rota también el refresh token. El UPDATE va condicionado al que se usó:
  // si otro proceso renovó en el medio, no se pisa el par nuevo con uno ya
  // descartado.
  const actualizadas = await db
    .update(cuentasMp)
    .set({
      accessTokenCifrado: cifrarToken(t.access_token!),
      ...(t.refresh_token ? { refreshTokenCifrado: cifrarToken(t.refresh_token) } : {}),
      ...(t.public_key ? { publicKey: t.public_key } : {}),
      expiresAt: vencimiento(t.expires_in),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(cuentasMp.id, turno.id),
        eq(cuentasMp.refreshTokenCifrado, turno.refreshTokenCifrado),
      ),
    )
    .returning({ id: cuentasMp.id, expiresAt: cuentasMp.expiresAt });

  if (actualizadas.length === 0) {
    throw new Error("otro proceso renovó la cuenta en el medio; se descartó este token");
  }
  return { renovada: { alias: turno.alias, venceEl: actualizadas[0].expiresAt } };
}
