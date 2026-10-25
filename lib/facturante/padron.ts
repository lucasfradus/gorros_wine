import type { CondicionIva } from "@/lib/db/schema";
// Relativos y con extensión: lo importa `scripts/prueba-facturacion.ts`, que
// corre en Node sin bundler.
import { TAX_TREATMENT } from "./mappers.ts";
import { PROVINCIAS } from "./provincias.ts";

/**
 * El padrón de ARCA, tal como lo devuelve Facturante en `POST /User/VerifyCuit`.
 * Visto en producción el 2026-10-25: el domicilio viene en una sola cadena y la
 * provincia y la ciudad como ids. En el sandbox el domicilio viene vacío.
 */
export interface RespuestaPadron {
  cuitValid?: boolean;
  foundInPadron?: boolean;
  businessName?: string | null;
  taxTreatmentId?: number | null;
  /** "COMANDANTE TORRES 500", "CAAMA&#209;O 1103 Dpto:9-10", "… KM 51200 0". */
  fiscalAddress?: string | null;
  /** Id de provincia de Facturante: 1 CABA, 2 Buenos Aires… */
  stateId?: number | null;
  cityId?: number | null;
  postalCode?: string | null;
}

/** Lo que se le ofrece al formulario. `null` en lo que el padrón no trae. */
export interface DatosPadron {
  razonSocial: string | null;
  condicionIva: CondicionIva | null;
  calle: string | null;
  /** Código de `PROVINCIAS` ("AR-M"). */
  provincia: string | null;
  codigoPostal: string | null;
  /** Para resolver el nombre de la localidad (`GET /State/{id}/City`). */
  stateId: number | null;
  cityId: number | null;
}

/**
 * El id de provincia de Facturante es la posición en `PROVINCIAS`, que sigue el
 * orden de `GET /State` (verificado contra el sandbox el 2026-10-25, y en
 * Clicnet contra producción).
 */
export function provinciaPorId(id: number | null | undefined): string | null {
  return typeof id === "number" && id >= 1 && id <= PROVINCIAS.length ? PROVINCIAS[id - 1].code : null;
}

const CONDICION_POR_ID = new Map<number, CondicionIva>(
  Object.entries(TAX_TREATMENT).map(([condicion, id]) => [id, condicion as CondicionIva]),
);

const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** "CAAMA&#209;O" → "CAAMAÑO": el padrón trae entidades HTML. Portado de Clicnet. */
export function decodificarEntidades(texto: string | null | undefined): string | null {
  if (!texto) return null;
  return (
    texto
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
      .replace(/&([a-z]+);/gi, (m, n) => ENTIDADES[n.toLowerCase()] ?? m)
      .replace(/\s+/g, " ")
      .trim() || null
  );
}

/**
 * La calle del padrón, presentable. Se deja entera (calle, altura y depto en un
 * solo campo, que es como la pide la factura) y sólo se limpia: entidades,
 * espacios, y el " 0" que ARCA agrega como altura cuando la calle ya trae
 * número ("ACCESO N/RAMAL PILAR KM 51200 0").
 */
export function limpiarCalle(texto: string | null | undefined): string | null {
  const limpio = decodificarEntidades(texto);
  if (!limpio) return null;
  return limpio.replace(/\s+0$/, "").trim() || null;
}

/** `null` si el CUIT no está en el padrón. */
export function datosDelPadron(r: RespuestaPadron): DatosPadron | null {
  if (!r.foundInPadron) return null;
  return {
    razonSocial: decodificarEntidades(r.businessName),
    condicionIva: r.taxTreatmentId != null ? (CONDICION_POR_ID.get(r.taxTreatmentId) ?? null) : null,
    calle: limpiarCalle(r.fiscalAddress),
    provincia: provinciaPorId(r.stateId),
    codigoPostal: r.postalCode?.trim() || null,
    stateId: r.stateId ?? null,
    cityId: r.cityId ?? null,
  };
}
