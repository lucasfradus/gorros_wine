/** Los 11 dígitos pelados, sin guiones ni puntos. */
export const soloDigitos = (s: string) => s.replace(/\D/g, "");

const PESOS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

/**
 * Dígito verificador (módulo 11). Se valida acá y no se deja a Facturante
 * porque un CUIT mal tipeado en una Factura A no siempre rebota: si existe,
 * sale autorizada a nombre de otro y sólo se arregla con nota de crédito.
 */
export function cuitValido(cuit: string): boolean {
  const d = soloDigitos(cuit);
  if (d.length !== 11) return false;
  const suma = PESOS.reduce((s, p, i) => s + p * Number(d[i]), 0);
  const resto = 11 - (suma % 11);
  const verificador = resto === 11 ? 0 : resto;
  // Un resto de 10 no tiene dígito posible: ARCA no emite esos números.
  return verificador !== 10 && verificador === Number(d[10]);
}

export function formatCuit(cuit: string): string {
  const d = soloDigitos(cuit);
  return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d[10]}` : cuit;
}
