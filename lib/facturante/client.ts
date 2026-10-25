import type {
  DocumentoResponse,
  ElectronicDocument,
  ElectronicDocumentResponse,
  FacturanteEnvelope,
} from "./types";
import { FacturanteApiError, detalleErrores, normalizeErrors } from "./errors";
import type { ConfigFacturante } from "./config";
import type { RespuestaPadron } from "./padron";

/**
 * Cliente HTTP de Facturante, portado de Clicnet (que lo usa en producción).
 *
 * El éxito se decide por `communicationStatus` (200/201) y no por el status
 * HTTP. El token dura 24 h: se cachea 23 en memoria y se renueva una vez ante
 * un 401.
 */

const TIMEOUT_MS = 12_000;

/**
 * El POST de emisión espera bastante más que el resto. Es el único request que
 * no se puede reintentar: un timeout deja el comprobante en duda —pudo haberse
 * emitido— y Facturante no deduplica por externalId. Facturante tarda 13-20 s
 * normalmente y tiene arranques en frío que pasan los 12 s; en Clicnet, con
 * 12 s, 3 de 15 emisiones quedaron en duda. Esperar de más cuesta segundos;
 * cortar de más cuesta trabajo manual y riesgo de duplicar.
 */
const EMISION_TIMEOUT_MS = 45_000;

const EXITO = new Set([200, 201]);
const TOKEN_TTL_MS = 23 * 60 * 60 * 1000;

let tokenCache: { token: string; vence: number; clave: string } | null = null;

async function leer<T>(res: Response): Promise<FacturanteEnvelope<T> | null> {
  const texto = await res.text();
  try {
    return JSON.parse(texto) as FacturanteEnvelope<T>;
  } catch {
    return null;
  }
}

async function obtenerToken(cfg: ConfigFacturante, forzar = false): Promise<string> {
  const clave = `${cfg.baseUrl}:${cfg.companyId}:${cfg.username}`;
  if (!forzar && tokenCache?.clave === clave && tokenCache.vence > Date.now()) {
    return tokenCache.token;
  }

  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl}/Token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Username: cfg.username,
        Password: cfg.password,
        CountryId: 1,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    throw new FacturanteApiError({
      message: `No se pudo entrar a Facturante: ${e instanceof Error ? e.message : String(e)}`,
      fase: "TOKEN",
    });
  }

  const body = await leer<{ token: string }>(res);
  const token = body?.response?.token;
  if (!token) {
    const detalle = detalleErrores(body?.errors);
    throw new FacturanteApiError({
      message: `Facturante no dio acceso${detalle ? `: ${detalle}` : ""}`,
      errors: body?.errors,
      httpStatus: res.status,
      communicationStatus: body?.communicationStatus,
      fase: "TOKEN",
    });
  }

  tokenCache = { token, vence: Date.now() + TOKEN_TTL_MS, clave };
  return token;
}

const noAutorizado = (res: Response, body: FacturanteEnvelope<unknown> | null) =>
  res.status === 401 ||
  body?.communicationStatus === 401 ||
  normalizeErrors(body?.errors).some((e) => e.code === 401);

/** Llama con el token cacheado y, si da 401, una vez más con uno nuevo. */
async function llamar<T>(
  cfg: ConfigFacturante,
  ruta: string,
  init: { method: string; body?: string; timeout: number },
): Promise<T> {
  const pedir = async (token: string) => {
    const res = await fetch(`${cfg.baseUrl}${ruta}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        CompanyId: String(cfg.companyId),
        SubsidiaryId: String(cfg.subsidiaryId),
      },
      body: init.body,
      signal: AbortSignal.timeout(init.timeout),
    });
    return { res, body: await leer<T>(res) };
  };

  let { res, body } = await pedir(await obtenerToken(cfg));
  if (noAutorizado(res, body)) {
    ({ res, body } = await pedir(await obtenerToken(cfg, true)));
  }

  if (!body || !EXITO.has(body.communicationStatus)) {
    throw new FacturanteApiError({
      message: mensajeError(res, body),
      errors: body?.errors,
      httpStatus: res.status,
      communicationStatus: body?.communicationStatus,
    });
  }
  return body.response;
}

/** POST /ElectronicDocument con un solo comprobante. */
export async function emitirEnFacturante(
  cfg: ConfigFacturante,
  doc: ElectronicDocument,
): Promise<DocumentoResponse> {
  const r = await llamar<ElectronicDocumentResponse>(cfg, "/ElectronicDocument", {
    method: "POST",
    body: JSON.stringify([doc]),
    timeout: EMISION_TIMEOUT_MS,
  });
  const primero = r.documents?.[0];
  if (!primero) {
    throw new FacturanteApiError({ message: "Facturante respondió sin el comprobante" });
  }
  return primero;
}

/**
 * El padrón de ARCA para un CUIT (`POST /User/VerifyCuit`). Responde con el
 * token de empresa; el domicilio sólo viene en producción.
 */
export async function consultarCuit(cfg: ConfigFacturante, cuit: string): Promise<RespuestaPadron> {
  return llamar<RespuestaPadron>(cfg, "/User/VerifyCuit", {
    method: "POST",
    body: JSON.stringify({ Cuit: cuit }),
    timeout: TIMEOUT_MS,
  });
}

/**
 * Las ciudades de una provincia (`GET /State/{id}/City`). No hay consulta por
 * id de ciudad, así que para nombrar la del padrón se trae la lista entera
 * (2931 en Buenos Aires): quien la use, que la cachee.
 */
export async function ciudadesDe(
  cfg: ConfigFacturante,
  stateId: number,
): Promise<{ id: number; name: string }[]> {
  const r = await llamar<{ cities?: { id: number; name: string }[] }>(cfg, `/State/${stateId}/City`, {
    method: "GET",
    timeout: TIMEOUT_MS,
  });
  return r.cities ?? [];
}

/** Estado actual de un comprobante ya enviado, por su id interno. */
export async function consultarEnFacturante(
  cfg: ConfigFacturante,
  internalId: number,
): Promise<DocumentoResponse> {
  const r = await llamar<ElectronicDocumentResponse>(
    cfg,
    `/company/${cfg.companyId}/ElectronicDocument/${internalId}`,
    { method: "GET", timeout: TIMEOUT_MS },
  );
  const doc = r.documents?.[0];
  if (!doc) throw new FacturanteApiError({ message: "Facturante no encuentra el comprobante" });
  return doc;
}

/** Mensaje legible: primero `errors[]`, que es donde está la explicación. */
function mensajeError(res: Response, body: unknown): string {
  const b = body as { communicationMsg?: string; title?: string; errors?: unknown } | null;
  const detalle = detalleErrores(b?.errors);
  if (detalle) return detalle;
  if (b?.title) return b.title;
  if (b?.communicationMsg) return b.communicationMsg;
  return `Facturante respondió HTTP ${res.status}`;
}
