import type { FormaPago } from "@/lib/db/schema";

/**
 * Cómo se lee cada forma de pago en la pantalla. En la factura se imprime el
 * nombre del maestro de Facturante (`SELL_CONDITION` en mappers.ts), que dice
 * lo mismo con otras palabras ("Transferencia Bancaria", "Contado"…).
 */
export const FORMAS_DE_PAGO: Record<FormaPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  debito: "Tarjeta de débito",
  credito: "Tarjeta de crédito",
  electronico: "Mercado Pago / QR",
  deposito: "Depósito bancario",
  cheque: "Cheque",
  cuenta_corriente: "Cuenta corriente",
};

/** Las que ofrece la factura manual, en el orden del desplegable. */
export const FORMAS_MANUALES: FormaPago[] = [
  "efectivo",
  "transferencia",
  "debito",
  "credito",
  "electronico",
  "deposito",
  "cheque",
  "cuenta_corriente",
];
