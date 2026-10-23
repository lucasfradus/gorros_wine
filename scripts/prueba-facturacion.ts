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
import { letraPara, validarReceptor, type DatosReceptor } from "../lib/facturacion/reglas.ts";
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
const fb = mapFactura({
  letra: vB.letra,
  receptor: vB.receptor,
  importeCentavos: 1_234_567,
  descripcion: "Vinos y productos",
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
  importeCentavos: 14_000_050,
  descripcion: "Vinos y productos",
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

if (ver) {
  console.log("\n— Factura B —\n" + JSON.stringify([fb], null, 2));
  console.log("\n— Factura A —\n" + JSON.stringify([fa], null, 2));
  console.log("\n— NC A —\n" + JSON.stringify([nc], null, 2));
}

console.log(fallos ? `\n${fallos} fallo(s)` : "\nTodo bien");
process.exit(fallos ? 1 : 0);
