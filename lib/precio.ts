import type { Moneda } from "@/lib/db/schema";

/**
 * Plata: formateo y conversión.
 *
 * Todo entra y sale en **centavos enteros**. Es la única forma de que
 * $14.900,55 siga siendo $14.900,55 después de pasar por la base y volver;
 * con `float` termina en $14899.999999998.
 *
 * Aparte de `lib/format.ts`, que es sólo fechas.
 */

/**
 * Separador de miles a mano y no con `Intl.NumberFormat`, por lo mismo que
 * `formatPrice` en `lib/data.ts`: el resultado tiene que ser idéntico en el
 * servidor y en el navegador, o React avisa que la hidratación no coincide.
 * `Intl` depende de los datos de locale que tenga cada runtime.
 */
function conMiles(entero: number): string {
  return String(entero).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Centavos a texto. Los decimales sólo aparecen si los hay: en pesos casi
 * ningún precio los tiene y "$14.900,00" es ruido.
 */
export function formatearPrecio(centavos: number, moneda: Moneda): string {
  const signo = moneda === "USD" ? "US$ " : "$";
  const entero = Math.trunc(centavos / 100);
  const decimales = Math.abs(centavos % 100);
  const base = signo + conMiles(entero);

  return decimales === 0
    ? base
    : `${base},${String(decimales).padStart(2, "0")}`;
}

/**
 * Cuánto sale en pesos, para poder comparar y ordenar un catálogo con precios
 * mezclados.
 *
 * Devuelve `null` cuando el precio está en dólares y todavía no hay ninguna
 * cotización cargada. Es a propósito: quien llama tiene que decir "falta
 * cargar la cotización" y no mostrar un número inventado ni un $0.
 */
export function aPesos(
  centavos: number,
  moneda: Moneda,
  arsPorUsdCentavos: number | null,
): number | null {
  if (moneda === "ARS") return centavos;
  if (!arsPorUsdCentavos) return null;

  // centavos de dólar × centavos de peso por dólar ÷ 100 = centavos de peso.
  return Math.round((centavos * arsPorUsdCentavos) / 100);
}

/**
 * Lo que se escribió en el formulario, a centavos.
 *
 * El input es `type="number"`, así que llega sin separador de miles y con
 * punto decimal; igual se acepta la coma, que es lo que sale de un teclado
 * argentino si alguien la pega a mano. Devuelve `null` si no es un número
 * válido — nada de `parseFloat`, que se traga "12abc" y devuelve 12.
 */
export function aCentavos(entrada: string): number | null {
  const limpio = entrada.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return null;

  // El ×100 sobre un decimal da 1490054.9999…; el redondeo lo acomoda.
  return Math.round(Number(limpio) * 100);
}
