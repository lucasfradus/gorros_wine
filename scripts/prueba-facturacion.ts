/**
 * Las reglas de facturación y el request que se le manda a Facturante, sin
 * mandar nada: ni red ni base. Es la revisión que se corre antes de tocar los
 * mappers, porque lo que sale mal acá sale mal con CAE y se arregla con nota de
 * crédito.
 *
 *   npm run prueba:facturacion            → chequeos
 *   npm run prueba:facturacion -- --ver   → además imprime los requests
 */
import { cuitValido } from "../lib/facturacion/cuit.ts";
import {
  letraPara,
  rangoDeFecha,
  validarFecha,
  validarReceptor,
  type DatosReceptor,
} from "../lib/facturacion/reglas.ts";
import {
  mapFactura,
  mapNotaCredito,
  conWebhook,
  numeroDeComprobante,
  parseDocumento,
  prefijoDeComprobante,
} from "../lib/facturante/mappers.ts";
import type { DocumentoResponse } from "../lib/facturante/types.ts";
import { FacturanteApiError, clasificarFallo } from "../lib/facturante/errors.ts";
import { sePuedeMarcarNoEmitido } from "../lib/facturacion/estado.ts";
import {
  calcular,
  parseImporte,
  validarRenglones,
  type Renglon,
} from "../lib/facturacion/calculo.ts";
import { camposACompletar, datosDeReceptor } from "../lib/facturacion/cliente-receptor.ts";

let fallos = 0;
const ok = (q: string, real: unknown, esperado: unknown) => {
  const bien = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bien) fallos++;
  console.log(
    bien ? "  ok  " : " FALLA",
    q,
    bien ? "" : `\n        real=${JSON.stringify(real)}\n        esp.=${JSON.stringify(esperado)}`,
  );
};
const ver = process.argv.includes("--ver");

console.log("\nCUIT");
ok("el del emisor es válido", cuitValido("20-16068090-4"), true);
ok("dígito verificador mal", cuitValido("20160680905"), false);
ok("10 dígitos", cuitValido("2016068090"), false);

console.log("\nLetra por condición");
ok("RI → A", letraPara("responsable_inscripto"), "A");
ok("CF → B", letraPara("consumidor_final"), "B");
ok("exento → B", letraPara("exento"), "B");
ok("monotributo → todavía no", letraPara("monotributo"), null);

const base: DatosReceptor = {
  condicionIva: "consumidor_final",
  docTipo: "ninguno",
  docNumero: "",
  nombre: "",
  email: "",
  calle: "",
  ciudad: "",
  provincia: "",
};
const motivo = (d: Partial<DatosReceptor>, importe = 1_000_000) => {
  const v = validarReceptor({ ...base, ...d }, importe);
  return v.ok ? "ok" : v.error;
};

console.log("\nValidación del receptor");
ok("B anónima", motivo({}), "ok");
ok(
  "B anónima desde el umbral",
  motivo({}, 10_000_000 * 100),
  "Desde $10.000.000 el consumidor final tiene que identificarse con DNI o CUIT.",
);
ok("B con DNI", motivo({ docTipo: "dni", docNumero: "30.123.456" }), "ok");
ok("DNI corto", motivo({ docTipo: "dni", docNumero: "123" }), "El DNI tiene que tener 7 u 8 dígitos.");
const a: Partial<DatosReceptor> = {
  condicionIva: "responsable_inscripto",
  docTipo: "cuit",
  docNumero: "20-16068090-4",
  nombre: "PRUEBA SA",
  calle: "Av. Siempreviva 742",
  provincia: "AR-CF",
};
ok("A completa", motivo(a), "ok");
ok("A sin domicilio", motivo({ ...a, calle: "", provincia: "" }), "La Factura A lleva el domicilio del cliente.");
ok("A sin provincia", motivo({ ...a, provincia: "" }), "Elegí la provincia del domicilio.");
ok("A con DNI", motivo({ ...a, docTipo: "dni" }), "Para esa condición frente al IVA hace falta el CUIT.");
ok("A con CUIT inválido", motivo({ ...a, docNumero: "20160680905" }), "El CUIT no es válido: revisá los 11 dígitos.");
ok("A sin razón social", motivo({ ...a, nombre: " " }), "Falta la razón social.");
ok(
  "monotributo",
  motivo({ ...a, condicionIva: "monotributo" }),
  "Todavía no se factura a monotributistas: falta verificar su código en Facturante.",
);

console.log("\nRequest de una Factura B anónima");
const vB = validarReceptor(base, 1_234_567);
if (!vB.ok) throw new Error(vB.error);
/** Lo que arma `reservarFactura` para un cobro de MP: un renglón por el total. */
const unRenglon = (importe: number): Renglon[] => [
  {
    productoId: null,
    descripcion: "Vinos y productos",
    cantidad: 1,
    precioUnitarioCentavos: importe,
    descuentoPct: 0,
    alcanzado: false,
  },
];
const fb = mapFactura({
  letra: vB.letra,
  receptor: vB.receptor,
  renglones: unRenglon(1_234_567),
  percepciones: [],
  formaPago: "electronico",
  dia: "2026-10-23",
  externalId: "gorros-f-prueba",
  posId: 13665,
});
ok("letra B = 3", fb.header.documentType, 3);
ok("factura = 1", fb.header.documentGeneralType, 1);
ok("POS interno", fb.header.detail.pos, 13665);
ok("bienes, pago electrónico", [fb.header.detail.good, fb.header.detail.sellCondition[0].conditionType], [1, 6]);
ok("fecha ISO", fb.header.detail.dates, [{ dateType: 1, dateTime: "2026-10-23T00:00:00" }]);
ok("receptor Otro con 0, consumidor final", fb.header.receiver, {
  countryId: 1,
  documentType: 6,
  documentNumber: "0",
  businessName: "CONSUMIDOR FINAL",
  taxTreatment: 4,
});
ok("sin domicilio", fb.header.address, undefined);
ok("el request reservado no lleva webhook (ni su secreto)", fb.header.settings, undefined);
ok("importe en pesos con centavos, bruto, 21%", fb.items[0].price, { unitPrice: 12345.67, priceType: 2 });
ok("vat 7", fb.items[0].vat, 7);
ok("externalId", fb.header.identification?.[0].code, "gorros-f-prueba");

console.log("\nRequest de una Factura A");
const vA = validarReceptor({ ...base, ...a, email: "x@y.com" }, 14_000_050);
if (!vA.ok) throw new Error(vA.error);
const fa = mapFactura({
  letra: vA.letra,
  receptor: vA.receptor,
  renglones: unRenglon(14_000_050),
  percepciones: [],
  formaPago: "electronico",
  dia: "2026-10-23",
  externalId: "gorros-f-prueba-a",
  posId: 13665,
});
ok("letra A = 1", fa.header.documentType, 1);
ok("receptor CUIT pelado, RI", fa.header.receiver, {
  countryId: 1,
  documentType: 1,
  documentNumber: "20160680904",
  businessName: "PRUEBA SA",
  taxTreatment: 1,
  mails: [{ mail: "x@y.com", favorite: true }],
});
ok("domicilio con código de provincia", fa.header.address, {
  countryId: 1,
  street: "Av. Siempreviva 742",
  state: "AR-CF",
});
const faEnvio = conWebhook(fa, { url: "https://gorros.example/api/webhooks/facturante", headers: [{ key: "k", value: "v" }] });
ok("al enviar se agrega el webhook con resource", faEnvio.header.settings?.integrationDetails.webHooks[0].resource, "ElectronicDocument");
ok("sin secreto no hay webhook", conWebhook(fa, undefined).header.settings, undefined);

console.log("\nRespuesta de Facturante");
// La forma de la FA 00015-00000001 real (montos y CAE de ejemplo).
const respuesta: DocumentoResponse = {
  identifications: { internalId: 987654, externalId: "gorros-f-prueba-a" },
  state: { id: 3, state: "AUTHORIZED" },
  fiscalData: {
    fullNumber: "FA 00015-00000002",
    nationalAuthorizationCode: "76000000000000",
    nationalAuthorizationCodeExpires: "02/11/2026",
    number: 2,
    pos: "00015",
  },
  accessData: { pdfUrl: "http://x/pdf", fiscalQrUrl: "https://afip/qr" },
  total: 140000.5,
};
const r = parseDocumento(respuesta);
ok("autorizado", r.estado, "autorizado");
ok("vencimiento del CAE a ISO", r.caeVencimiento, "2026-11-02");
ok("total a centavos", r.totalCentavos, 14_000_050);
ok("PDF por https", r.pdfUrl, "https://x/pdf");
ok("estado desconocido = en proceso", parseDocumento({ ...respuesta, state: { id: 1, state: "TO AUTHORIZE" } }).estado, "en_proceso");
// Como lo devolvió el sandbox una B con fecha anterior a la última emitida.
const noAutorizado = parseDocumento({
  ...respuesta,
  state: { id: 4, state: "UNAUTHORIZED" },
  fiscalData: {
    ...respuesta.fiscalData,
    fullNumber: "",
    nationalAuthorizationCode: "",
    governmentMessage: "Existe un comprobante con fecha posterior a la que se intenta emitir",
  },
});
ok(
  "UNAUTHORIZED = rechazado, con el motivo de ARCA",
  [noAutorizado.estado, noAutorizado.motivo],
  ["rechazado", "Existe un comprobante con fecha posterior a la que se intenta emitir"],
);
ok("autorizado no trae motivo", r.motivo, null);
ok("número desde fiscalData", numeroDeComprobante(respuesta, null), 2);
ok("número desde el texto", numeroDeComprobante(null, "FA 00015-00000002"), 2);
ok("prefijo como entero", prefijoDeComprobante(null, "FA 00015-00000002"), 15);

console.log("\nNota de crédito de la A");
const nc = mapNotaCredito(
  fa,
  { posId: 13665, posPrefix: 15, number: 2, cuitEmisor: "20160680904", fecha: "2026-10-23T00:00:00" },
  { dia: "2026-10-24", externalId: "gorros-nc-prueba" },
);
ok("misma letra, NC = 2", [nc.header.documentType, nc.header.documentGeneralType], [1, 2]);
ok("fecha propia", nc.header.detail.dates[0].dateTime, "2026-10-24T00:00:00");
ok("externalId propio", nc.header.identification?.[0].code, "gorros-nc-prueba");
ok("mismo receptor y domicilio", [nc.header.receiver, nc.header.address], [fa.header.receiver, fa.header.address]);
ok("mismos ítems", nc.items, fa.items);
ok("asociada a la factura", nc.header.fiscalAssociations, [
  {
    pos: 13665,
    posPrefix: 15,
    generalDocumentType: 1,
    documentType: 1,
    number: 2,
    cuit: "20160680904",
    date: "2026-10-23T00:00:00",
  },
]);

console.log("\n¿Pudo haberse emitido? (clasificación de fallos)");
const err = (o: ConstructorParameters<typeof FacturanteApiError>[0]) => clasificarFallo(new FacturanteApiError(o)).estado;
ok("código de Facturante → rechazado", err({ message: "x", errors: [{ code: 100050 }], httpStatus: 200, communicationStatus: 400 }), "rechazado");
ok("código de ARCA → rechazado", err({ message: "x", errors: [{ code: 10015 }] }), "rechazado");
ok("500 con código 500 → en proceso", err({ message: "x", errors: [{ code: 500 }], httpStatus: 500, communicationStatus: 500 }), "en_proceso");
ok("5xx sin códigos → en proceso", err({ message: "x", httpStatus: 502 }), "en_proceso");
ok("falló el token → error", err({ message: "x", fase: "TOKEN" }), "error");
ok("401 en la emisión → error", err({ message: "x", httpStatus: 401 }), "error");
ok("timeout (no es de Facturante) → en proceso", clasificarFallo(new DOMException("timeout", "TimeoutError")).estado, "en_proceso");

console.log("\n¿Se puede marcar como no emitido?");
const t0 = Date.parse("2026-10-23T12:00:00Z");
const fila = (o: Partial<{ estado: string; facturanteId: string | null; enviadoEn: Date | null; createdAt: Date }>) => ({ estado: "en_proceso", facturanteId: null, enviadoEn: new Date(t0), createdAt: new Date(t0), ...o });
ok("en proceso, a los 2 min → todavía no", sePuedeMarcarNoEmitido(fila({}), t0 + 2 * 60_000), false);
ok("en proceso, a los 6 min → sí", sePuedeMarcarNoEmitido(fila({}), t0 + 6 * 60_000), true);
ok("con id de Facturante → nunca (se consulta)", sePuedeMarcarNoEmitido(fila({ facturanteId: "1" }), t0 + 60 * 60_000), false);
ok("pendiente a los 5 min → todavía no", sePuedeMarcarNoEmitido(fila({ estado: "pendiente", enviadoEn: null }), t0 + 5 * 60_000), false);
ok("pendiente a los 11 min → sí", sePuedeMarcarNoEmitido(fila({ estado: "pendiente", enviadoEn: null }), t0 + 11 * 60_000), true);
ok("autorizado → nunca", sePuedeMarcarNoEmitido(fila({ estado: "autorizado" }), t0 + 60 * 60_000), false);

console.log("\nImporte tipeado");
ok("forma argentina", parseImporte("12.345,67"), 1_234_567);
ok("con signo y espacios", parseImporte("$ 12.345"), 1_234_500);
ok("coma decimal sin miles", parseImporte("12345,6"), 1_234_560);
ok("punto decimal", parseImporte("12345.67"), 1_234_567);
ok("punto de miles", parseImporte("1.234.567"), 123_456_700);
ok("entero", parseImporte("15000"), 1_500_000);
ok("coma con tres dígitos (ambiguo) → no", parseImporte("12,345"), null);
ok("forma yanqui", parseImporte("1,234.56"), 123_456);
ok("dos separadores iguales con decimales → no", parseImporte("1.234.567.89"), null);
ok("miles mal agrupados → no", parseImporte("12.34.567"), null);
ok("letras → no", parseImporte("12a"), null);
ok("cero → no", parseImporte("0,00"), null);
ok("vacío → no", parseImporte(""), null);
ok("más de $100.000.000 → no", parseImporte("100.000.000,01"), null);

const renglon = (o: Partial<Renglon>): Renglon => ({
  productoId: null,
  descripcion: "Malbec Reserva",
  cantidad: 1,
  precioUnitarioCentavos: 1_500_000,
  descuentoPct: 0,
  alcanzado: true,
  ...o,
});

console.log("\nValidación de renglones");
ok("sin renglones", validarRenglones([]), "Agregá al menos un renglón.");
ok("válido", validarRenglones([renglon({})]), null);
ok("cantidad 0", validarRenglones([renglon({ cantidad: 0 })]), "Renglón 1: la cantidad tiene que ser un entero entre 1 y 9.999.");
ok("cantidad con coma", validarRenglones([renglon({ cantidad: 1.5 })]), "Renglón 1: la cantidad tiene que ser un entero entre 1 y 9.999.");
ok("sin precio", validarRenglones([renglon({}), renglon({ precioUnitarioCentavos: 0 })]), "Renglón 2: falta el precio.");
ok("descuento 100", validarRenglones([renglon({ descuentoPct: 100 })]), "Renglón 1: el descuento va de 0 a 99%.");
ok("sin descripción", validarRenglones([renglon({ descripcion: "  " })]), "Renglón 1: falta la descripción.");
ok("descuento con tres decimales", validarRenglones([renglon({ descuentoPct: 12.345 })]), "Renglón 1: el descuento admite hasta dos decimales.");
ok("descuento con dos decimales", validarRenglones([renglon({ descuentoPct: 12.35 })]), null);
ok("precio final en $0", validarRenglones([renglon({ precioUnitarioCentavos: 40, descuentoPct: 99.99 })]), "Renglón 1: con ese descuento el precio queda en $0.");

console.log("\nCuentas de una venta");
// Las cuentas a mano: neto = redondeo(subtotal / 1,21) por renglón.
const venta = [
  // 6 × $15.000 = $90.000, -10% = $81.000 → neto $66.942,15
  renglon({ cantidad: 6, descuentoPct: 10 }),
  // 2 × $4.999,99 = $9.999,98 → neto $8.264,45. Copas: fuera de la percepción.
  renglon({ descripcion: "Copa Riedel", cantidad: 2, precioUnitarioCentavos: 499_999, alcanzado: false }),
  // $12.345,67 -12,5% ($1.543,21) = $10.802,46 → neto $8.927,65
  renglon({ descripcion: "Espumante", precioUnitarioCentavos: 1_234_567, descuentoPct: 12.5 }),
];
const c1 = calcular(venta, { percepcionIva: true });
ok("subtotales por renglón", c1.renglones.map((r) => r.subtotalCentavos), [8_100_000, 999_998, 1_080_246]);
ok("descuentos por renglón", c1.renglones.map((r) => r.descuentoCentavos), [900_000, 0, 154_321]);
ok("netos por renglón", c1.renglones.map((r) => r.netoCentavos), [6_694_215, 826_445, 892_765]);
ok("neto e IVA suman el subtotal", [c1.netoCentavos, c1.ivaCentavos], [8_413_425, 1_766_819]);
// Base: sólo vino y espumante = $75.869,80 → 3% = $2.276,09, no supera $3.000.
ok("percepción bajo el mínimo: no se aplica", c1.percepciones, []);
ok("…pero se informa", c1.percepcionBajoUmbral?.montoCentavos, 227_609);
ok("total sin percepción", c1.totalCentavos, 10_180_244);

// 7 × $9,99 al 33%: el precio con descuento se redondea por unidad ($6,69,
// que es lo que se imprime y lo que multiplica Facturante) → $46,83. Sobre el
// renglón entero daría $46,85, y la factura no cerraría.
const c3 = calcular([renglon({ cantidad: 7, precioUnitarioCentavos: 999, descuentoPct: 33 })], { percepcionIva: false });
ok("redondeo por unidad", [c3.renglones[0].precioFinalCentavos, c3.renglones[0].subtotalCentavos, c3.renglones[0].descuentoCentavos], [669, 4683, 2310]);

// 12 × $15.000 = $180.000 → neto $148.760,33 → 3% = $4.462,81.
const c2 = calcular([renglon({ cantidad: 12 })], { percepcionIva: true });
ok("percepción sobre el mínimo", c2.percepciones, [
  { tipo: "iva_rg5329", alicuotaBp: 300, baseCentavos: 14_876_033, montoCentavos: 446_281 },
]);
ok("total con percepción", c2.totalCentavos, 18_446_281);
ok("cliente sin percepción", calcular([renglon({ cantidad: 12 })], { percepcionIva: false }).percepciones, []);
ok("todo fuera de la percepción", calcular([renglon({ cantidad: 12, alcanzado: false })], { percepcionIva: true }).percepcionBajoUmbral, null);
// $121.000 → neto $100.000 → 3% = $3.000 justos: "supera" es estricto.
ok("$3.000 justos no se percibe", calcular([renglon({ precioUnitarioCentavos: 12_100_000 })], { percepcionIva: true }).percepciones.length, 0);
ok("$3.000,01 sí", calcular([renglon({ precioUnitarioCentavos: 12_100_021 })], { percepcionIva: true }).percepciones[0]?.montoCentavos, 300_001);

console.log("\nRequest de una venta");
const fv = mapFactura({
  letra: vA.letra,
  receptor: vA.receptor,
  renglones: venta,
  percepciones: c2.percepciones,
  formaPago: "efectivo",
  dia: "2026-10-24",
  externalId: "gorros-f-venta",
  posId: 13665,
});
ok("efectivo = 1", fv.header.detail.sellCondition[0].conditionType, 1);
// El descuento va dentro del precio (la bonificación sale mal impresa en la B).
ok("un ítem por renglón, con el descuento en el precio", fv.items.map((i) => [i.quantity, i.price.unitPrice]), [[6, 13500], [2, 4999.99], [1, 10802.46]]);
ok("cantidad × precio da el subtotal calculado", fv.items.map((i) => Math.round(i.quantity * i.price.unitPrice * 100)), c1.renglones.map((x) => x.subtotalCentavos));
ok("el descuento se nombra en la descripción", fv.items.map((i) => i.description), [
  "Malbec Reserva (10% dto.)",
  "Copa Riedel",
  "Espumante (12,5% dto.)",
]);
ok("percepción como tributo, en monto", fv.header.tributes, [
  { tributeId: 2, amount: 4462.81, amountAffected: 148760.33, amountType: 1, comment: "RG 5329" },
]);
ok("sin percepción no hay tributes", fb.header.tributes, undefined);
const ncv = mapNotaCredito(
  fv,
  { posId: 13665, posPrefix: 15, number: 3, cuitEmisor: "20160680904", fecha: "2026-10-24T00:00:00" },
  { dia: "2026-10-24", externalId: "gorros-nc-venta" },
);
ok("la NC copia los tributos", ncv.header.tributes, fv.header.tributes);
ok("la NC copia ítems y descuentos", ncv.items, fv.items);

console.log("\nFecha de la factura");
ok("sin facturas previas: 5 días atrás hasta hoy", rangoDeFecha("2026-10-25", null), { min: "2026-10-20", max: "2026-10-25" });
ok("cruza el mes", rangoDeFecha("2026-11-02", null).min, "2026-10-28");
ok("la última de la letra manda si es más nueva", rangoDeFecha("2026-10-25", "2026-10-23").min, "2026-10-23");
ok("una última más vieja no importa", rangoDeFecha("2026-10-25", "2026-10-01").min, "2026-10-20");
const rango = rangoDeFecha("2026-10-25", "2026-10-23");
ok("dentro del rango", validarFecha("2026-10-24", rango), null);
ok("futura, no", validarFecha("2026-10-26", rango), "La factura no puede tener fecha futura.");
ok("antes de la última, no", validarFecha("2026-10-22", rango)?.startsWith("La fecha más vieja posible es 23/10/2026"), true);
ok("fecha imposible, no", validarFecha("2026-02-31x", rango), "La fecha no es válida.");
const fCheque = mapFactura({
  letra: "B",
  receptor: { condicionIva: "consumidor_final", docTipo: "ninguno", docNumero: null, nombre: null, email: null, domicilio: null },
  renglones: [{ productoId: null, descripcion: "x", cantidad: 1, precioUnitarioCentavos: 100, descuentoPct: 0, alcanzado: false }],
  percepciones: [],
  formaPago: "cheque",
  dia: "2026-10-23",
  externalId: "gorros-f-cheque",
  posId: 1,
});
ok("cheque = condición 12 del maestro", fCheque.header.detail.sellCondition[0].conditionType, 12);
ok("la fecha elegida va al request", fCheque.header.detail.dates[0].dateTime, "2026-10-23T00:00:00");

console.log("\nCliente desde la factura");
const ri = {
  condicionIva: "responsable_inscripto" as const,
  docTipo: "cuit" as const,
  docNumero: "30712345675",
  nombre: "Almacén Sur SRL",
  email: "compras@almacensur.com",
  domicilio: { calle: "Av. Siempreviva 742", ciudad: "Rosario", provincia: "AR-S" },
};
const dRi = datosDeReceptor(ri, true);
ok(
  "RI: razón social = lo tipeado, CUIT con guiones, percepción",
  dRi && [dRi.razonSocial, dRi.documento, dRi.percepcionIva],
  ["Almacén Sur SRL", "30-71234567-5", true],
);
ok(
  "consumidor final sin nombre: no hay cliente que guardar",
  datosDeReceptor(
    { condicionIva: "consumidor_final", docTipo: "ninguno", docNumero: null, nombre: null, email: null, domicilio: null },
    false,
  ),
  null,
);
const dCf = datosDeReceptor(
  { condicionIva: "consumidor_final", docTipo: "dni", docNumero: "30123456", nombre: "Ana Pérez", email: null, domicilio: null },
  true,
);
ok(
  "CF: sin razón social, DNI pelado, nunca percepción",
  dCf && [dCf.razonSocial, dCf.documento, dCf.percepcionIva],
  [null, "30123456", false],
);

const sinDatos = {
  documento: null,
  razonSocial: null,
  condicionIva: null,
  email: null,
  direccion: null,
  localidad: null,
  provincia: null,
};
ok("cliente vacío: se completa todo", dRi && camposACompletar(sinDatos, dRi), {
  documento: "30-71234567-5",
  razonSocial: "Almacén Sur SRL",
  condicionIva: "responsable_inscripto",
  email: "compras@almacensur.com",
  direccion: "Av. Siempreviva 742",
  localidad: "Rosario",
  provincia: "AR-S",
});
ok(
  "lo cargado no se pisa",
  dRi &&
    camposACompletar(
      { ...sinDatos, documento: "30-71234567-5", razonSocial: "Otra SA", condicionIva: "exento", email: "x@y.com" },
      dRi,
    ),
  { direccion: "Av. Siempreviva 742", localidad: "Rosario", provincia: "AR-S" },
);
ok(
  "misma calle (sin importar mayúsculas): se le suma localidad y provincia",
  dRi &&
    camposACompletar(
      { ...sinDatos, direccion: "av. siempreviva 742 ", condicionIva: "responsable_inscripto", documento: "x", razonSocial: "x", email: "x" },
      dRi,
    ),
  { localidad: "Rosario", provincia: "AR-S" },
);
ok(
  "otra calle: ni localidad ni provincia",
  dRi &&
    camposACompletar(
      { ...sinDatos, direccion: "Depósito, Ruta 9 km 3", condicionIva: "responsable_inscripto", documento: "x", razonSocial: "x", email: "x" },
      dRi,
    ),
  {},
);

if (ver) {
  console.log("\n— Factura B —\n" + JSON.stringify([fb], null, 2));
  console.log("\n— Factura A —\n" + JSON.stringify([fa], null, 2));
  console.log("\n— NC A —\n" + JSON.stringify([nc], null, 2));
}

console.log(fallos ? `\n${fallos} fallo(s)` : "\nTodo bien");
process.exit(fallos ? 1 : 0);
