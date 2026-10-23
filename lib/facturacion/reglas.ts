import type { ComprobanteLetra, CondicionIva } from "@/lib/db/schema";
import type { ReceptorFiscal } from "@/lib/facturante/mappers";
// Relativos y con extensión: así lo puede importar `scripts/prueba-facturacion.ts`,
// que corre en Node sin bundler.
import { esProvinciaValida } from "../facturante/provincias.ts";
import { cuitValido, soloDigitos } from "./cuit.ts";

/**
 * Qué comprobante corresponde a quién, y qué datos hacen falta.
 *
 * Todo se valida antes de mandar nada: lo que rebota Facturante cuesta un
 * viaje de 15 s, y lo que no rebota y sale mal cuesta una nota de crédito.
 */

/**
 * Desde cuánto un consumidor final tiene que identificarse en una Factura B.
 * ARCA lo subió a $10.000.000 en 2025 (RG 5700). Confirmar el valor vigente si
 * Facturante rechaza con 10015 por debajo de este monto.
 */
export const UMBRAL_IDENTIFICACION_B_CENTAVOS = 10_000_000 * 100;

/**
 * La letra sale del receptor, no se elige: Gorros es Responsable Inscripto,
 * así que a otro RI le corresponde A y a un consumidor final o exento, B. Si no
 * coincide, Facturante rechaza con 100050.
 *
 * Monotributo devuelve `null`: también es A, pero su código de Facturante (5)
 * está inferido y no se quiere estrenar con una factura real. Se habilita
 * después de verificarlo con una emisión.
 */
export function letraPara(condicion: CondicionIva): ComprobanteLetra | null {
  switch (condicion) {
    case "responsable_inscripto":
      return "A";
    case "consumidor_final":
    case "exento":
      return "B";
    case "monotributo":
      return null;
  }
}

export interface DatosReceptor {
  condicionIva: CondicionIva;
  docTipo: "cuit" | "dni" | "ninguno";
  docNumero: string;
  nombre: string;
  email: string;
  calle: string;
  ciudad: string;
  provincia: string;
}

export type Validacion =
  | { ok: true; letra: ComprobanteLetra; receptor: ReceptorFiscal }
  | { ok: false; error: string };

export function validarReceptor(d: DatosReceptor, importeCentavos: number): Validacion {
  const letra = letraPara(d.condicionIva);
  if (!letra) {
    return {
      ok: false,
      error:
        "Todavía no se factura a monotributistas: falta verificar su código en Facturante.",
    };
  }

  const nombre = d.nombre.trim();
  const calle = d.calle.trim();
  const numero = soloDigitos(d.docNumero);
  const conDomicilio = calle !== "" || d.provincia !== "";

  // Quien no es consumidor final se identifica siempre con CUIT.
  const exigeCuit = d.condicionIva !== "consumidor_final";
  if (exigeCuit && d.docTipo !== "cuit") {
    return { ok: false, error: "Para esa condición frente al IVA hace falta el CUIT." };
  }

  if (d.docTipo === "cuit" && !cuitValido(numero)) {
    return { ok: false, error: "El CUIT no es válido: revisá los 11 dígitos." };
  }
  if (d.docTipo === "dni" && (numero.length < 7 || numero.length > 8)) {
    return { ok: false, error: "El DNI tiene que tener 7 u 8 dígitos." };
  }
  if (d.docTipo === "ninguno" && importeCentavos >= UMBRAL_IDENTIFICACION_B_CENTAVOS) {
    return {
      ok: false,
      error: "Desde $10.000.000 el consumidor final tiene que identificarse con DNI o CUIT.",
    };
  }

  if (exigeCuit && !nombre) {
    return { ok: false, error: "Falta la razón social." };
  }

  // La A lleva domicilio: sin él, Facturante imprime el de Gorros como si
  // fuera el del cliente.
  if (letra === "A" && !calle) {
    return { ok: false, error: "La Factura A lleva el domicilio del cliente." };
  }
  if (conDomicilio && !calle) {
    return { ok: false, error: "Falta la calle del domicilio." };
  }
  if (conDomicilio && !esProvinciaValida(d.provincia)) {
    return { ok: false, error: "Elegí la provincia del domicilio." };
  }

  return {
    ok: true,
    letra,
    receptor: {
      condicionIva: d.condicionIva,
      docTipo: d.docTipo,
      docNumero: d.docTipo === "ninguno" ? null : numero,
      nombre: nombre || null,
      email: d.email.trim() || null,
      domicilio: conDomicilio
        ? { calle, ciudad: d.ciudad.trim() || null, provincia: d.provincia }
        : null,
    },
  };
}
