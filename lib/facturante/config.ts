/**
 * El emisor de Gorros, leído del entorno.
 *
 * Es uno solo —un CUIT, una sucursal, un punto de venta—, así que vive en
 * variables y no en una tabla (en Clicnet había una config por sede). Se lee
 * en cada llamada y no en un `const` de módulo para que un cambio de variable
 * en Railway aplique con un reinicio, sin rebuild.
 *
 * Si falta algo devuelve `null`: la pantalla avisa qué configurar en vez de
 * romper, igual que `lib/content/bucket.ts` sin credenciales de S3.
 */
export interface ConfigFacturante {
  baseUrl: string;
  username: string;
  password: string;
  companyId: number;
  subsidiaryId: number;
  /** Id **interno** del punto de venta en Facturante (13665), no su prefijo. */
  posId: number;
  emisorCuit: string;
}

const entero = (v: string | undefined) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export function configFacturante(): ConfigFacturante | null {
  const e = process.env;
  const companyId = entero(e.FACTURANTE_COMPANY_ID);
  const subsidiaryId = entero(e.FACTURANTE_SUBSIDIARY_ID);
  const posId = entero(e.FACTURANTE_POS_ID);
  const cuit = e.EMISOR_CUIT?.replace(/\D/g, "");

  if (
    !e.FACTURANTE_BASE_URL ||
    !e.FACTURANTE_USERNAME ||
    !e.FACTURANTE_PASSWORD ||
    !companyId ||
    !subsidiaryId ||
    !posId ||
    !cuit
  ) {
    return null;
  }

  return {
    baseUrl: e.FACTURANTE_BASE_URL.replace(/\/$/, ""),
    // Copiar el usuario desde un mail pega `mailto:` y Facturante contesta
    // "Username or Password incorrect", que manda a buscar el error a otro lado.
    username: e.FACTURANTE_USERNAME.trim().replace(/^mailto:/i, ""),
    password: e.FACTURANTE_PASSWORD,
    companyId,
    subsidiaryId,
    posId,
    emisorCuit: cuit,
  };
}

export function facturacionConfigurada(): boolean {
  return configFacturante() !== null;
}

/** Header con el que Facturante nos reenvía el secreto en el webhook. */
export const WEBHOOK_TOKEN_HEADER = "x-gorros-token";

/**
 * El webhook que se le pide a Facturante en cada comprobante.
 *
 * Sin `FACTURANTE_WEBHOOK_SECRET` no se pide: el endpoint rechazaría todo, y
 * no tiene sentido publicar la URL en cada request. En local tampoco sirve
 * (Facturante no llega a localhost); ahí el CAE vuelve en la respuesta del POST.
 *
 * `facturante-content-type: application/json` es lo que hace que lo manden en
 * JSON: por defecto llega en XML.
 */
export function webhookFacturante() {
  const secret = process.env.FACTURANTE_WEBHOOK_SECRET;
  const sitio = process.env.NEXT_PUBLIC_SITE_URL;
  if (!secret || !sitio) return undefined;
  return {
    url: `${sitio.replace(/\/$/, "")}/api/webhooks/facturante`,
    headers: [
      { key: "facturante-content-type", value: "application/json" },
      { key: WEBHOOK_TOKEN_HEADER, value: secret },
    ],
  };
}
