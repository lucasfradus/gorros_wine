import type {
  ComprobanteEstado,
  ComprobanteLetra,
  CondicionIva,
  FormaPago,
} from "@/lib/db/schema";
import {
  precioConDescuento,
  type Percepcion,
  type Renglon,
  type TipoPercepcion,
} from "../facturacion/calculo.ts";
import type {
  DocAddress,
  DocItem,
  DocReceiver,
  DocTribute,
  DocumentoResponse,
  ElectronicDocument,
} from "./types";
// Con extensión: así lo puede importar `scripts/prueba-facturacion.ts`, que
// corre en Node sin bundler.
import { urlPdfComprobante } from "./pdf-url.ts";

/**
 * Del cobro al request de Facturante, y de la respuesta a las columnas de
 * `comprobantes`. Los códigos son los del maestro **propio** de Facturante, no
 * los de AFIP: todos están verificados en Clicnet emitiendo contra Facturante,
 * salvo los marcados.
 */

export const DOCUMENT_TYPE: Record<ComprobanteLetra, number> = { A: 1, B: 3 };
export const GENERAL_TYPE = { FACTURA: 1, NOTA_CREDITO: 2 } as const;

/** `receiver.documentType`. "Otro" es el único que acepta el número 0. */
const DOC_RECEPTOR = { cuit: 1, dni: 5, otro: 6 } as const;

/**
 * `receiver.taxTreatment`. En Clicnet el 3 y el 4 estuvieron invertidos meses
 * sin que nadie lo notara, porque los dos dan Factura B: lo que salía mal era
 * la condición informada a AFIP. El 5 (Monotributo) está **inferido**: por eso
 * todavía no se factura a monotributistas (ver `reglas.ts`).
 */
const TAX_TREATMENT: Record<CondicionIva, number> = {
  responsable_inscripto: 1,
  exento: 3,
  consumidor_final: 4,
  monotributo: 5,
};

/** Maestro `GET /Vat`: 7 es 21%. El 5 es **5%**, no 21 (Clicnet lo tuvo mal). */
const VAT_21 = 7;
/** Bruto con IVA incluido: el total del comprobante es el monto del cobro. */
const PRECIO_BRUTO = 2;
/** Bienes: con Servicios Facturante completa el período con la fecha de hoy. */
const GOOD_BIENES = 1;
/**
 * `detail.sellCondition[].conditionType`: el maestro `GET /SellCondition`,
 * leído del sandbox el 2026-10-25 (20 condiciones, ninguna "otros"; sin
 * condición, el PDF imprime "Contado"). Todo lo que entra por MP es "pago
 * electrónico".
 */
const SELL_CONDITION: Record<FormaPago, number> = {
  efectivo: 1, // CASH
  debito: 2, // DEBIT CARD
  credito: 3, // CREDIT CARD
  deposito: 4, // BANK DEPOSIT
  transferencia: 5, // BANK TRANSFER
  electronico: 6, // ELECTRONIC PAYMENT
  cuenta_corriente: 11, // CURRENT ACCOUNT
  cheque: 12, // CHECK
};

/** Maestro de tributos de Facturante (doc técnica, "Tributes"). */
const TRIBUTE_ID: Record<TipoPercepcion, number> = {
  iva_rg5329: 2, // Percepción Nacional IVA
};
const MONTO = 1;

/** Pesos con dos decimales, como los pide Facturante. */
const pesos = (centavos: number) => centavos / 100;
/** No hay una entrada propia en `GET /ExternalSoftware`; 12 es "Otro". */
const EXTERNAL_SOFTWARE_OTRO = 12;
const FECHA_COMPROBANTE = 1;

export interface Domicilio {
  calle: string;
  ciudad: string | null;
  /** Código de Facturante, "AR-B". */
  provincia: string;
}

/** Quién recibe el comprobante, ya validado por `reglas.ts`. */
export interface ReceptorFiscal {
  condicionIva: CondicionIva;
  docTipo: "cuit" | "dni" | "ninguno";
  docNumero: string | null;
  nombre: string | null;
  email: string | null;
  domicilio: Domicilio | null;
}

export interface WebhookConfig {
  url: string;
  headers: { key: string; value: string }[];
}

function receptorDe(r: ReceptorFiscal): DocReceiver {
  const mails = r.email ? [{ mail: r.email, favorite: true }] : undefined;
  if (r.docTipo === "ninguno") {
    // Consumidor final anónimo: Facturante exige el bloque receiver, y lo único
    // que acepta sin documento es "Otro" con número 0 (DNI con 0 da 100045).
    return {
      countryId: 1,
      documentType: DOC_RECEPTOR.otro,
      documentNumber: "0",
      businessName: r.nombre?.trim() || "CONSUMIDOR FINAL",
      taxTreatment: TAX_TREATMENT.consumidor_final,
      mails,
    };
  }
  return {
    countryId: 1,
    documentType: DOC_RECEPTOR[r.docTipo],
    // Con guiones o puntos Facturante rechaza con 100045.
    documentNumber: (r.docNumero ?? "").replace(/\D/g, ""),
    businessName: r.nombre?.trim() || "CONSUMIDOR FINAL",
    taxTreatment: TAX_TREATMENT[r.condicionIva],
    mails,
  };
}

/**
 * El domicilio va sólo si está completo. Sin él Facturante imprime el de la
 * sucursal del emisor como si fuera del cliente; con domicilio y sin provincia,
 * rechaza (100029).
 */
function domicilioDe(r: ReceptorFiscal): DocAddress | undefined {
  if (!r.domicilio) return undefined;
  return {
    countryId: 1,
    street: r.domicilio.calle,
    ...(r.domicilio.ciudad ? { city: r.domicilio.ciudad } : {}),
    state: r.domicilio.provincia,
  };
}

/**
 * El request con el webhook adentro. Se agrega **al enviar** y no al reservar:
 * el webhook lleva el secreto en un header, y el request reservado queda
 * guardado en `comprobantes.request_payload`, donde el secreto no tiene que
 * estar.
 */
export function conWebhook(doc: ElectronicDocument, webhook?: WebhookConfig): ElectronicDocument {
  const settings = settingsDe(webhook);
  return settings ? { ...doc, header: { ...doc.header, settings } } : doc;
}

function settingsDe(webhook?: WebhookConfig) {
  if (!webhook) return undefined;
  return {
    integrationDetails: {
      webHooks: [
        {
          // 1: cuando el comprobante queda autorizado.
          moment: 1,
          method: "POST",
          format: "JSON",
          resource: "ElectronicDocument",
          url: webhook.url,
          headers: webhook.headers,
        },
      ],
    },
  };
}

/** "2026-10-23" → "2026-10-23T00:00:00", el formato que no se presta a dd/mm. */
const fechaRequest = (dia: string) => `${dia}T00:00:00`;

/**
 * Un renglón al ítem de Facturante. El descuento viene aplicado en el precio y
 * nombrado en la descripción (por qué no como bonificación: ver
 * `precioConDescuento`). Sin descuento el ítem queda igual que siempre: el de
 * un cobro de MP no cambia.
 */
function itemDe(r: Renglon): DocItem {
  const descripcion =
    r.descuentoPct > 0
      ? `${r.descripcion} (${String(r.descuentoPct).replace(".", ",")}% dto.)`
      : r.descripcion;
  return {
    quantity: r.cantidad,
    name: descripcion,
    description: descripcion,
    measureUnit: 1,
    vat: VAT_21,
    price: { unitPrice: pesos(precioConDescuento(r)), priceType: PRECIO_BRUTO },
  };
}

/** Se manda el monto ya calculado (y no la alícuota): es el que se mostró. */
function tributoDe(p: Percepcion): DocTribute {
  return {
    tributeId: TRIBUTE_ID[p.tipo],
    amount: pesos(p.montoCentavos),
    amountAffected: pesos(p.baseCentavos),
    amountType: MONTO,
    ...(p.tipo === "iva_rg5329" ? { comment: "RG 5329" } : {}),
  };
}

export function mapFactura(opts: {
  letra: ComprobanteLetra;
  receptor: ReceptorFiscal;
  renglones: Renglon[];
  percepciones: Percepcion[];
  formaPago: FormaPago;
  /** Día del comprobante "YYYY-MM-DD", **en hora de Argentina**. */
  dia: string;
  externalId: string;
  posId: number;
}): ElectronicDocument {
  const address = domicilioDe(opts.receptor);
  return {
    header: {
      documentType: DOCUMENT_TYPE[opts.letra],
      documentGeneralType: GENERAL_TYPE.FACTURA,
      detail: {
        pos: opts.posId,
        good: GOOD_BIENES,
        sellCondition: [
          { conditionType: SELL_CONDITION[opts.formaPago], currency: "ARS", currencyValue: 1 },
        ],
        dates: [{ dateType: FECHA_COMPROBANTE, dateTime: fechaRequest(opts.dia) }],
        currencySettings: { currency: "ARS", currencyValue: 1 },
      },
      receiver: receptorDe(opts.receptor),
      ...(address ? { address } : {}),
      identification: [
        { externalSoftwareId: EXTERNAL_SOFTWARE_OTRO, code: opts.externalId, primary: true },
      ],
      ...(opts.percepciones.length > 0 ? { tributes: opts.percepciones.map(tributoDe) } : {}),
    },
    items: opts.renglones.map(itemDe),
  };
}

/** La factura que se anula, tal como la necesita `fiscalAssociations`. */
export interface FacturaOrigen {
  posId: number;
  /** Prefijo del punto de venta como entero: 15, no "00015". */
  posPrefix: number;
  number: number;
  cuitEmisor: string;
  /**
   * La fecha **literal** que se mandó al emitir la factura. Se copia del
   * request guardado: reformatear un Date puede correr el día por huso.
   */
  fecha: string;
}

/**
 * Nota de crédito por el total: receptor, domicilio, ítems y percepciones
 * espejo de la factura, misma letra, fecha propia y su propio externalId (si
 * heredara el de la factura, el webhook de la NC se aplicaría a la factura).
 * Sin las percepciones, la NC devolvería menos de lo que se facturó.
 */
export function mapNotaCredito(
  factura: ElectronicDocument,
  origen: FacturaOrigen,
  opts: { dia: string; externalId: string },
): ElectronicDocument {
  return {
    header: {
      documentType: factura.header.documentType,
      documentGeneralType: GENERAL_TYPE.NOTA_CREDITO,
      detail: {
        ...factura.header.detail,
        dates: [{ dateType: FECHA_COMPROBANTE, dateTime: fechaRequest(opts.dia) }],
      },
      receiver: factura.header.receiver,
      ...(factura.header.address ? { address: factura.header.address } : {}),
      identification: [
        { externalSoftwareId: EXTERNAL_SOFTWARE_OTRO, code: opts.externalId, primary: true },
      ],
      fiscalAssociations: [
        {
          pos: origen.posId,
          posPrefix: origen.posPrefix,
          generalDocumentType: GENERAL_TYPE.FACTURA,
          documentType: factura.header.documentType,
          number: origen.number,
          cuit: origen.cuitEmisor,
          date: origen.fecha,
        },
      ],
      ...(factura.header.tributes ? { tributes: factura.header.tributes } : {}),
    },
    items: factura.items,
  };
}

/** Número sin prefijo: de `fiscalData.number` o de "FA 00015-00000001". */
export function numeroDeComprobante(
  doc: DocumentoResponse | null,
  numeroCompleto: string | null,
): number | null {
  const n = doc?.fiscalData?.number;
  if (typeof n === "number" && Number.isFinite(n) && n > 0) return n;
  const m = numeroCompleto?.match(/(\d+)\s*$/);
  return m ? Number(m[1]) : null;
}

/** Prefijo como entero: de `fiscalData.pos` o de "FA 00015-00000001". */
export function prefijoDeComprobante(
  doc: DocumentoResponse | null,
  numeroCompleto: string | null,
): number | null {
  const pos = doc?.fiscalData?.pos;
  if (typeof pos === "string" && /^\d+$/.test(pos.trim())) return Number(pos);
  const m = numeroCompleto?.match(/(\d+)\s*-\s*\d+\s*$/);
  return m ? Number(m[1]) : null;
}

export interface ResultadoDocumento {
  facturanteId: number | null;
  estado: Extract<ComprobanteEstado, "autorizado" | "rechazado" | "en_proceso">;
  numeroCompleto: string | null;
  cae: string | null;
  /** "YYYY-MM-DD", para la columna `date`. */
  caeVencimiento: string | null;
  /** Lo que dijo ARCA al no autorizarlo. */
  motivo: string | null;
  pdfUrl: string | null;
  qrUrl: string | null;
  /** `null` si no vino: el webhook puede traer el total en 0. */
  totalCentavos: number | null;
}

const ESTADOS: Record<string, ResultadoDocumento["estado"]> = {
  AUTHORIZED: "autorizado",
  REJECTED: "rechazado",
  // ARCA lo rechazó (fecha anterior a la del último comprobante, por
  // ejemplo). Es final: leído como "en proceso", quedaba emitiéndose para
  // siempre. Visto en el sandbox el 2026-10-25, con el motivo en
  // `fiscalData.governmentMessage`.
  UNAUTHORIZED: "rechazado",
};

const oNull = (v: string | null | undefined) => (v && v.trim() ? v : null);

/** "dd/mm/yyyy" → "yyyy-mm-dd". */
function diaDesdeFacturante(s: string | null | undefined): string | null {
  const m = s?.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

export function parseDocumento(doc: DocumentoResponse): ResultadoDocumento {
  return {
    facturanteId: doc.identifications?.internalId || null,
    // Cualquier otro estado (PENDING, "TO AUTHORIZE"…) es que todavía no hay CAE.
    estado: ESTADOS[doc.state?.state?.toUpperCase() ?? ""] ?? "en_proceso",
    numeroCompleto: oNull(doc.fiscalData?.fullNumber),
    cae: oNull(doc.fiscalData?.nationalAuthorizationCode),
    caeVencimiento: diaDesdeFacturante(doc.fiscalData?.nationalAuthorizationCodeExpires),
    motivo: oNull(doc.fiscalData?.governmentMessage),
    pdfUrl: urlPdfComprobante(doc.accessData?.pdfUrl),
    qrUrl: oNull(doc.accessData?.fiscalQrUrl),
    totalCentavos: doc.total > 0 ? Math.round(doc.total * 100) : null,
  };
}
