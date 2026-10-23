import type { ComprobanteEstado } from "@/lib/db/schema";
import type { FacturanteError } from "./types";

/** Facturante devuelve `errors` como array, como objeto suelto o como null. */
export function normalizeErrors(raw: unknown): FacturanteError[] {
  if (Array.isArray(raw)) return raw as FacturanteError[];
  if (raw && typeof raw === "object") {
    const e = raw as Partial<FacturanteError>;
    if (typeof e.code === "number") return [e as FacturanteError];
  }
  return [];
}

/**
 * Texto legible de los errores. Es el único lugar donde Facturante explica qué
 * pasó: el `communicationMsg` de un error es casi siempre "Error" a secas. El
 * código va adelante porque es lo que permite buscarlo (100050 = letra que no
 * corresponde al receptor; 100014 = hay un comprobante posterior; 10015…).
 */
export function detalleErrores(raw: unknown): string {
  return normalizeErrors(raw)
    .map((e) => (e.message ? `[${e.code}] ${e.message}` : `[${e.code}]`))
    .join(" | ");
}

/**
 * En qué momento falló la llamada, que es lo que decide si se pudo haber
 * emitido: si falló pidiendo el token, el POST de emisión nunca salió.
 */
export type FaseError = "TOKEN" | "EMISION";

export class FacturanteApiError extends Error {
  readonly codes: number[];
  readonly httpStatus?: number;
  readonly communicationStatus?: number;
  readonly fase: FaseError;

  constructor(opts: {
    message: string;
    errors?: unknown;
    httpStatus?: number;
    communicationStatus?: number;
    fase?: FaseError;
  }) {
    super(opts.message);
    this.name = "FacturanteApiError";
    this.codes = normalizeErrors(opts.errors).map((e) => e.code);
    this.httpStatus = opts.httpStatus;
    this.communicationStatus = opts.communicationStatus;
    this.fase = opts.fase ?? "EMISION";
  }
}

/**
 * Traduce un fallo del envío al estado de la fila. La pregunta que decide todo
 * no es "¿falló?" sino **"¿pudo haberse emitido?"**:
 *
 * - Facturante o ARCA lo rechazaron por validación → no se emitió:
 *   `rechazado`, con el motivo. Se reconoce por el código: los de Facturante
 *   son de 6 dígitos (100050…) y los de ARCA de 5 (10015, 10016…). Un 500 con
 *   un "código" 500 no es un rechazo: pudo haber procesado antes de caerse.
 * - Falló pidiendo el token, o la emisión dio 401 → el POST no se procesó:
 *   `error`.
 * - Cualquier otra cosa (timeout, red, 5xx) → **no sabemos**: `en_proceso`,
 *   que es la verdad. No es un error y no se reintenta solo, porque Facturante
 *   no deduplica y saldría dos veces. Lo resuelve el webhook, o una persona
 *   mirando el panel de Facturante.
 */
export function clasificarFallo(e: unknown): {
  estado: Extract<ComprobanteEstado, "rechazado" | "error" | "en_proceso">;
  codigo: string | null;
  mensaje: string;
} {
  const api = e instanceof FacturanteApiError ? e : null;
  const mensaje = e instanceof Error ? e.message : "Error desconocido";
  const codigo = api?.codes[0] != null ? String(api.codes[0]) : null;

  if (api && (api.fase === "TOKEN" || api.httpStatus === 401 || api.communicationStatus === 401)) {
    return { estado: "error", codigo, mensaje };
  }
  if (api && api.codes.some((c) => c >= 10_000)) {
    return { estado: "rechazado", codigo, mensaje };
  }
  return { estado: "en_proceso", codigo, mensaje };
}
