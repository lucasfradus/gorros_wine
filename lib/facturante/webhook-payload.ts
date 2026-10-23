import type { DocumentoResponse } from "./types";

/**
 * El webhook de Facturante no tiene el formato de la API, y se normaliza acá
 * para que todo lo demás lea un solo formato:
 *
 * |                     | API                        | Webhook                         |
 * | ------------------- | -------------------------- | ------------------------------- |
 * | claves              | camelCase                  | **PascalCase**                  |
 * | "FA 00015-00000001" | `fiscalData.fullNumber`    | `FiscalData.ShortFullNumber`    |
 * | número largo        | `fiscalData.longFullNumber`| `FiscalData.FullNumber`         |
 *
 * O sea: `FullNumber` significa cosas distintas en cada lado. Capturado contra
 * el webhook real en Clicnet. La doc avisa que hay campos que pueden venir
 * vacíos o faltar, así que todo se lee a la defensiva.
 */

type Json = Record<string, unknown>;

const esObjeto = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Prueba PascalCase y camelCase. */
function prop(obj: unknown, nombre: string): unknown {
  if (!esObjeto(obj)) return undefined;
  return obj[nombre[0].toUpperCase() + nombre.slice(1)] ?? obj[nombre];
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
const num = (v: unknown) => (typeof v === "number" ? v : undefined);

/** Acepta el documento suelto (lo de hoy), un array o el envelope de la API. */
export function extraerDocumentoWebhook(body: unknown): Json | null {
  if (Array.isArray(body)) return esObjeto(body[0]) ? body[0] : null;
  if (!esObjeto(body)) return null;

  const documents = prop(prop(body, "response"), "documents") ?? prop(body, "documents");
  if (Array.isArray(documents)) return esObjeto(documents[0]) ? documents[0] : null;

  if (prop(body, "identifications") || prop(body, "fiscalData")) return body;
  return null;
}

export function normalizarDocumentoWebhook(doc: Json): DocumentoResponse {
  const ident = prop(doc, "identifications");
  const fiscal = prop(doc, "fiscalData");
  const access = prop(doc, "accessData");
  const state = prop(doc, "state");

  return {
    identifications: {
      internalId: num(prop(ident, "internalId")) ?? 0,
      externalId: str(prop(ident, "externalId")),
    },
    state: {
      id: num(prop(state, "id")) ?? 0,
      state: str(prop(state, "state")) ?? "",
    },
    fiscalData: {
      fullNumber:
        str(prop(fiscal, "shortFullNumber")) ?? str(prop(fiscal, "fullNumber")) ?? "",
      nationalAuthorizationCode: str(prop(fiscal, "nationalAuthorizationCode")) ?? "",
      nationalAuthorizationCodeExpires:
        str(prop(fiscal, "nationalAuthorizationCodeExpires")) ?? "",
      number: num(prop(fiscal, "number")),
      pos: str(prop(fiscal, "pos")) ?? undefined,
    },
    accessData: {
      pdfUrl: str(prop(access, "pdfUrl")),
      fiscalQrUrl: str(prop(access, "fiscalQrUrl")),
    },
    total: num(prop(doc, "total")) ?? 0,
  };
}
