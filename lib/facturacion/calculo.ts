/**
 * Las cuentas de una venta: de los renglones y la percepción a los totales que
 * se muestran y se facturan. Es la misma función en el formulario (para
 * mostrar), en el servidor (para emitir) y en `scripts/prueba-facturacion.ts`,
 * así que no importa nada de `@/`: corre en el navegador y en Node pelado.
 *
 * Todo en centavos enteros. Los decimales aparecen recién al armar el request
 * de Facturante, que pide pesos.
 */

/** Un renglón tal como lo carga la pantalla, ya validado. */
export interface Renglon {
  productoId: string | null;
  descripcion: string;
  cantidad: number;
  /** Con IVA incluido, como el precio del catálogo. */
  precioUnitarioCentavos: number;
  /** 0 a 99; admite decimales (12,5%). */
  descuentoPct: number;
  /** ¿Entra en la base de la percepción de IVA? Una copa no; un vino sí. */
  alcanzado: boolean;
}

export interface RenglonCalculado extends Renglon {
  /** El precio unitario con el descuento aplicado: es el que va a la factura. */
  precioFinalCentavos: number;
  /** Cantidad × precio, antes del descuento. */
  brutoCentavos: number;
  descuentoCentavos: number;
  /** Lo que paga el cliente por el renglón, IVA incluido. */
  subtotalCentavos: number;
  netoCentavos: number;
}

export type TipoPercepcion = "iva_rg5329";

export interface Percepcion {
  tipo: TipoPercepcion;
  /** En puntos básicos: 300 = 3%. Entero, para no multiplicar floats. */
  alicuotaBp: number;
  baseCentavos: number;
  montoCentavos: number;
}

/**
 * Régimen de percepción de IVA de la RG 5329/2023 (modificada por la RG 5334):
 * venta de alimentos, **bebidas**, higiene y limpieza a un Responsable
 * Inscripto que revende sin transformar. 3% del neto de lo alcanzado, y sólo si
 * la percepción **supera** $3.000 por operación. ARCA actualiza el umbral por
 * resolución: si cambia, se cambia acá.
 */
export const RG_5329 = {
  alicuotaBp: 300,
  umbralCentavos: 3_000 * 100,
} as const;

/** Tope de cordura para un importe tipeado. */
export const IMPORTE_MAXIMO_CENTAVOS = 100_000_000 * 100;

export interface Calculo {
  renglones: RenglonCalculado[];
  netoCentavos: number;
  ivaCentavos: number;
  percepciones: Percepcion[];
  /** La percepción que correspondía por cliente pero no llegó al mínimo: para
   *  decirlo en pantalla en vez de que desaparezca sin explicación. */
  percepcionBajoUmbral: Percepcion | null;
  totalCentavos: number;
}

/** El neto de un importe con IVA 21% incluido. */
const netoDe = (conIva: number) => Math.round((conIva * 100) / 121);

/**
 * El descuento va **dentro del precio unitario**, redondeado por unidad, y no
 * como bonificación del ítem: el PDF de la Factura B de Facturante imprime la
 * bonificación dividida por el precio unitario (6 botellas al 10% salen
 * "-60,00 %", con el subtotal bien; probado en el sandbox el 2026-10-24, se
 * mande como % o como monto). Así la factura dice exactamente lo que se
 * cobró, y el total es cantidad × este precio, que es la cuenta que hace
 * Facturante.
 */
export const precioConDescuento = (r: Pick<Renglon, "precioUnitarioCentavos" | "descuentoPct">) =>
  Math.round((r.precioUnitarioCentavos * (100 - r.descuentoPct)) / 100);

export function calcular(renglones: Renglon[], opts: { percepcionIva: boolean }): Calculo {
  const calculados = renglones.map((r): RenglonCalculado => {
    const bruto = r.cantidad * r.precioUnitarioCentavos;
    const precioFinal = precioConDescuento(r);
    const subtotal = r.cantidad * precioFinal;
    const descuento = bruto - subtotal;
    return {
      ...r,
      precioFinalCentavos: precioFinal,
      brutoCentavos: bruto,
      descuentoCentavos: descuento,
      subtotalCentavos: subtotal,
      netoCentavos: netoDe(subtotal),
    };
  });

  const suma = (f: (r: RenglonCalculado) => number, filtro = (_: RenglonCalculado) => true) =>
    calculados.filter(filtro).reduce((s, r) => s + f(r), 0);
  const subtotal = suma((r) => r.subtotalCentavos);
  const neto = suma((r) => r.netoCentavos);

  let percepcion: Percepcion | null = null;
  if (opts.percepcionIva) {
    const base = suma((r) => r.netoCentavos, (r) => r.alcanzado);
    if (base > 0) {
      percepcion = {
        tipo: "iva_rg5329",
        alicuotaBp: RG_5329.alicuotaBp,
        baseCentavos: base,
        montoCentavos: Math.round((base * RG_5329.alicuotaBp) / 10_000),
      };
    }
  }
  const aplica = percepcion !== null && percepcion.montoCentavos > RG_5329.umbralCentavos;
  const percepciones = aplica && percepcion ? [percepcion] : [];

  return {
    renglones: calculados,
    netoCentavos: neto,
    ivaCentavos: subtotal - neto,
    percepciones,
    percepcionBajoUmbral: aplica ? null : percepcion,
    totalCentavos: subtotal + percepciones.reduce((s, p) => s + p.montoCentavos, 0),
  };
}

/**
 * Lo que se le exige a una venta antes de calcularla. Devuelve el primer
 * problema, en el idioma de la pantalla.
 */
export function validarRenglones(renglones: Renglon[]): string | null {
  if (renglones.length === 0) return "Agregá al menos un renglón.";
  if (renglones.length > 50) return "Hasta 50 renglones por factura.";
  for (const [i, r] of renglones.entries()) {
    const n = `Renglón ${i + 1}`;
    if (!r.descripcion.trim()) return `${n}: falta la descripción.`;
    if (r.descripcion.length > 200) return `${n}: la descripción es muy larga.`;
    if (!Number.isInteger(r.cantidad) || r.cantidad < 1 || r.cantidad > 9_999) {
      return `${n}: la cantidad tiene que ser un entero entre 1 y 9.999.`;
    }
    if (!Number.isSafeInteger(r.precioUnitarioCentavos) || r.precioUnitarioCentavos <= 0) {
      return `${n}: falta el precio.`;
    }
    if (!(r.descuentoPct >= 0 && r.descuentoPct < 100)) {
      return `${n}: el descuento va de 0 a 99%.`;
    }
    // Dos decimales como mucho: es lo que guarda `comprobante_items` y lo que
    // dice la descripción. Con más, lo facturado y lo guardado no coincidirían.
    if (Math.abs(r.descuentoPct * 100 - Math.round(r.descuentoPct * 100)) > 1e-9) {
      return `${n}: el descuento admite hasta dos decimales.`;
    }
    if (precioConDescuento(r) <= 0) return `${n}: con ese descuento el precio queda en $0.`;
  }
  const total = renglones.reduce((s, r) => s + r.cantidad * r.precioUnitarioCentavos, 0);
  if (total > IMPORTE_MAXIMO_CENTAVOS) return "El total supera $100.000.000.";
  return null;
}

/**
 * Un importe tipeado a centavos. Acepta la forma argentina ("12.345,67") y las
 * que salen de copiar de otro lado ("12345.67", "$ 12.345", "1,234.56"). La
 * coma o el punto seguidos de uno o dos dígitos al final son los decimales; el
 * otro separador agrupa de a tres. La coma sola sólo puede ser decimal:
 * "12,345" es ambiguo y se rechaza. `null` si no se entiende o no es positivo:
 * mejor preguntar que facturar $12.345 por $12,35.
 */
export function parseImporte(texto: string): number | null {
  const s = texto.replace(/[$\s]/g, "");
  if (!/^\d[\d.,]*$/.test(s)) return null;

  let entero = s;
  let decimales = "";
  let separadorDecimal = "";
  const m = s.match(/^(.*\d)([.,])(\d{1,2})$/);
  if (m) {
    [, entero, separadorDecimal, decimales] = m;
  }
  const miles = separadorDecimal === "." ? "," : ".";
  const agrupado = new RegExp(`^\\d{1,3}(\\${miles}\\d{3})+$`);
  if (!/^\d+$/.test(entero) && !agrupado.test(entero)) return null;

  const centavos = Number(entero.replace(/[.,]/g, "")) * 100 + Number(decimales.padEnd(2, "0"));
  if (!Number.isSafeInteger(centavos) || centavos <= 0 || centavos > IMPORTE_MAXIMO_CENTAVOS) {
    return null;
  }
  return centavos;
}
