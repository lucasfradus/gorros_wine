/**
 * Tipos del API de Facturante: sólo lo que Gorros usa (Clicnet tiene además
 * alta de empresas, sucursales y la cuenta de revendedor).
 *
 * El body es camelCase (la doc dice PascalCase y se equivoca), salvo el
 * webhook, que sí llega en PascalCase: ver `webhook-payload.ts`. El status
 * HTTP no es confiable: manda `communicationStatus`.
 */

export interface FacturanteError {
  code: number;
  message?: string;
}

export interface FacturanteEnvelope<T> {
  communicationStatus: number;
  communicationMsg: string;
  errors: FacturanteError[];
  response: T;
}

// ── Request: POST /ElectronicDocument ──────────────────────────────────────

export interface DocReceiver {
  countryId: number;
  /** Maestro propio de Facturante, no el de AFIP: 1 CUIT · 5 DNI · 6 Otro. */
  documentType: number;
  documentNumber: string;
  businessName: string;
  /** 1 RI · 3 Exento · 4 Consumidor Final · 5 Monotributo. */
  taxTreatment: number;
  /** Se imprime en el comprobante. */
  mails?: { mail: string; favorite?: boolean }[];
}

/** Domicilio del **receptor**. `state` es el código de provincia ("AR-B"). */
export interface DocAddress {
  countryId: number;
  street: string;
  city?: string;
  state: string;
}

export interface DocDate {
  /** 1 = fecha del comprobante. */
  dateType: number;
  /** ISO "yyyy-MM-ddT00:00:00": con dd/mm AFIP rechaza (10016). */
  dateTime: string;
}

export interface DocDetail {
  pos: number;
  /** Concepto AFIP: 1 Bienes, que no pide período de servicio. */
  good: number;
  sellCondition: { conditionType: number; currency: string; currencyValue: number }[];
  dates: DocDate[];
  currencySettings: { currency: string; currencyValue: number };
}

/** `code` es nuestro externalId: vuelve en la respuesta y en el webhook. */
export interface DocIdentification {
  externalSoftwareId: number;
  code: string;
  primary: boolean;
}

export interface DocWebhook {
  moment: number;
  method: string;
  format: string;
  url: string;
  /** Obligatorio: sin él Facturante rechaza con 100037. */
  resource: string;
  headers?: { key: string; value: string }[];
}

/** Lo que ata una nota de crédito a la factura que revierte. */
export interface FiscalAssociation {
  pos: number;
  /** Entero (15), no el string "00015": así lo pide el swagger. */
  posPrefix: number;
  generalDocumentType: number;
  documentType: number;
  number: number;
  cuit: string;
  date: string;
}

export interface DocHeader {
  /** Letra: 1 A · 3 B. */
  documentType: number;
  /** 1 Factura · 2 Nota de crédito. */
  documentGeneralType: number;
  detail: DocDetail;
  receiver: DocReceiver;
  address?: DocAddress;
  identification?: DocIdentification[];
  settings?: { integrationDetails: { webHooks: DocWebhook[] } };
  fiscalAssociations?: FiscalAssociation[];
  tributes?: DocTribute[];
}

/**
 * Una percepción o tributo del comprobante. Va en el header, no por ítem.
 * `amountType` **no se omite**: sin él Facturante toma 2 y lee `amount` como
 * porcentaje.
 */
export interface DocTribute {
  /** Maestro de Facturante: 2 Percepción Nacional IVA, 4 IIBB AGIP, 5 ARBA… */
  tributeId: number;
  amount: number;
  /** La base imponible. */
  amountAffected: number;
  /** 1 monto · 2 porcentaje. */
  amountType: number;
  comment?: string;
}

export interface DocItem {
  quantity: number;
  name: string;
  description: string;
  measureUnit: number;
  /** Maestro `GET /Vat` de Facturante: 7 = 21% (el 5 es 5%, no 21). */
  vat: number;
  /** priceType 2 = bruto, IVA incluido: el total sale igual al cobro. */
  price: { unitPrice: number; priceType: number };
}

export interface ElectronicDocument {
  header: DocHeader;
  items: DocItem[];
}

// ── Response ───────────────────────────────────────────────────────────────

export interface DocumentoResponse {
  identifications: { internalId: number; externalId: string | null };
  /** AUTHORIZED · REJECTED · PENDING… */
  state: { id: number; state: string };
  fiscalData: {
    /** El corto: "FA 00015-00000001". */
    fullNumber: string;
    nationalAuthorizationCode: string;
    /** "dd/mm/yyyy". */
    nationalAuthorizationCodeExpires: string;
    number?: number;
    /** Prefijo del punto de venta, "00015". */
    pos?: string;
    /** Por qué ARCA no lo autorizó, en castellano: "Existe un comprobante con
     *  fecha posterior a la que se intenta emitir". Vacío si se autorizó. */
    governmentMessage?: string | null;
  };
  accessData: {
    pdfUrl: string | null;
    fiscalQrUrl: string | null;
  };
  /** En pesos, no en centavos. */
  total: number;
}

export interface ElectronicDocumentResponse {
  totalDocuments: number;
  documents: DocumentoResponse[];
}
