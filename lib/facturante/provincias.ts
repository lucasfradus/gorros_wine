/**
 * Provincias con el código que Facturante espera en `address.state` (el `code`
 * de `GET /State`, no el id). Es un catálogo que no cambia: va escrito acá.
 */
export const PROVINCIAS = [
  { code: "AR-CF", nombre: "Ciudad Autónoma de Buenos Aires" },
  { code: "AR-B", nombre: "Buenos Aires" },
  { code: "AR-K", nombre: "Catamarca" },
  { code: "AR-H", nombre: "Chaco" },
  { code: "AR-U", nombre: "Chubut" },
  { code: "AR-X", nombre: "Córdoba" },
  { code: "AR-W", nombre: "Corrientes" },
  { code: "AR-E", nombre: "Entre Ríos" },
  { code: "AR-P", nombre: "Formosa" },
  { code: "AR-Y", nombre: "Jujuy" },
  { code: "AR-L", nombre: "La Pampa" },
  { code: "AR-F", nombre: "La Rioja" },
  { code: "AR-M", nombre: "Mendoza" },
  { code: "AR-N", nombre: "Misiones" },
  { code: "AR-Q", nombre: "Neuquén" },
  { code: "AR-R", nombre: "Río Negro" },
  { code: "AR-A", nombre: "Salta" },
  { code: "AR-J", nombre: "San Juan" },
  { code: "AR-D", nombre: "San Luis" },
  { code: "AR-Z", nombre: "Santa Cruz" },
  { code: "AR-S", nombre: "Santa Fe" },
  { code: "AR-G", nombre: "Santiago del Estero" },
  { code: "AR-V", nombre: "Tierra del Fuego" },
  { code: "AR-T", nombre: "Tucumán" },
] as const;

const CODIGOS = new Set<string>(PROVINCIAS.map((p) => p.code));

export function esProvinciaValida(code: string | null | undefined): boolean {
  return !!code && CODIGOS.has(code);
}
