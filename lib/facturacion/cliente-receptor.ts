import type { Cliente, CondicionIva } from "@/lib/db/schema";
import type { ReceptorFiscal } from "@/lib/facturante/mappers";
// Relativo y con extensión: lo importa `scripts/prueba-facturacion.ts`, que
// corre en Node sin bundler.
import { formatCuit } from "./cuit.ts";

/**
 * Qué se le guarda a un cliente a partir de una factura. Las reglas, sin base:
 * la escritura la hace `reservar()` en `emitir.ts`, dentro de la misma
 * transacción que el comprobante.
 *
 * Dos reglas: **completar, nunca pisar** (lo que el cliente ya tenía cargado
 * lo cargó alguien a propósito) y **no duplicar** (un CUIT o DNI que ya es de
 * un cliente asocia a ese, aunque se pida crear uno).
 */

export interface DatosCliente {
  nombre: string;
  razonSocial: string | null;
  documento: string | null;
  condicionIva: CondicionIva;
  email: string | null;
  direccion: string | null;
  localidad: string | null;
  provincia: string | null;
  percepcionIva: boolean;
}

/**
 * Lo que la factura sabe del receptor, en columnas de `clientes`. `null` si no
 * hay nombre: un "Consumidor final" sin nombre no es un cliente que se pueda
 * volver a encontrar.
 */
export function datosDeReceptor(r: ReceptorFiscal, percepcionIva: boolean): DatosCliente | null {
  if (!r.nombre) return null;
  return {
    nombre: r.nombre,
    // Para quien no es consumidor final, lo tipeado es la razón social.
    razonSocial: r.condicionIva === "consumidor_final" ? null : r.nombre,
    documento: r.docNumero ? (r.docTipo === "cuit" ? formatCuit(r.docNumero) : r.docNumero) : null,
    condicionIva: r.condicionIva,
    email: r.email,
    direccion: r.domicilio?.calle ?? null,
    localidad: r.domicilio?.ciudad ?? null,
    provincia: r.domicilio?.provincia ?? null,
    percepcionIva: percepcionIva && r.condicionIva === "responsable_inscripto",
  };
}

type Completable = Pick<
  Cliente,
  "documento" | "razonSocial" | "condicionIva" | "email" | "direccion" | "localidad" | "provincia"
>;

const vacio = (v: string | null) => v === null || v.trim() === "";
const mismaCalle = (a: string | null, b: string | null) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Los campos que el cliente tiene vacíos y la factura trae. Localidad y
 * provincia sólo si son de la misma dirección: completarle la provincia de un
 * domicilio fiscal a su dirección de entrega de otra ciudad la dejaría mal.
 */
export function camposACompletar(cliente: Completable, d: DatosCliente): Partial<Completable> {
  const cambios: Partial<Completable> = {};
  if (vacio(cliente.documento) && d.documento) cambios.documento = d.documento;
  if (vacio(cliente.razonSocial) && d.razonSocial) cambios.razonSocial = d.razonSocial;
  if (cliente.condicionIva === null) cambios.condicionIva = d.condicionIva;
  if (vacio(cliente.email) && d.email) cambios.email = d.email;

  const direccionNueva = vacio(cliente.direccion) && d.direccion;
  if (direccionNueva) cambios.direccion = d.direccion;
  if (direccionNueva || mismaCalle(cliente.direccion, d.direccion)) {
    if (vacio(cliente.localidad) && d.localidad) cambios.localidad = d.localidad;
    if (vacio(cliente.provincia) && d.provincia) cambios.provincia = d.provincia;
  }
  return cambios;
}
