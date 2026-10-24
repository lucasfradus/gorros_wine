/**
 * Calibración contra el sandbox de Facturante: manda facturas de varios
 * renglones, con descuentos y con percepción, y compara el total que calcula
 * Facturante con el nuestro (`calculo.ts`). Es lo que hay que ver antes de la
 * primera factura manual real: un centavo de diferencia es un comprobante
 * que no cierra con lo que se cobró.
 *
 *   npx tsx scripts/_facturante-sandbox.ts            → dry-run: imprime requests y totales
 *   APPLY=1 npx tsx scripts/_facturante-sandbox.ts    → emite en el sandbox
 *
 * Se niega a correr si FACTURANTE_BASE_URL no es la de test.
 */
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";

import { configFacturante } from "../lib/facturante/config";
import { emitirEnFacturante } from "../lib/facturante/client";
import {
  mapFactura,
  mapNotaCredito,
  numeroDeComprobante,
  parseDocumento,
  prefijoDeComprobante,
} from "../lib/facturante/mappers";
import { calcular, type Renglon } from "../lib/facturacion/calculo";
import { validarReceptor, type DatosReceptor } from "../lib/facturacion/reglas";
import { hoyEnArgentina } from "../lib/format";
import type { FormaPago } from "../lib/db/schema";
import type { ElectronicDocument } from "../lib/facturante/types";

// Antes de leer la config: `configFacturante()` mira process.env al llamarla.
loadEnvConfig(process.cwd());

function configDelSandbox() {
  const c = configFacturante();
  if (!c) throw new Error("Falta la configuración de Facturante en .env.local.");
  if (!/synctest|apitest/.test(c.baseUrl)) {
    throw new Error(`${c.baseUrl} no es el sandbox: este script sólo emite en test.`);
  }
  return c;
}
const cfg = configDelSandbox();
const aplicar = process.env.APPLY === "1";
const pesos = (c: number) => (c / 100).toFixed(2);

const cf: DatosReceptor = {
  condicionIva: "consumidor_final",
  docTipo: "ninguno",
  docNumero: "",
  nombre: "",
  email: "",
  calle: "",
  ciudad: "",
  provincia: "",
};
const ri: DatosReceptor = {
  condicionIva: "responsable_inscripto",
  docTipo: "cuit",
  docNumero: "30710946147",
  nombre: "LINKSIDE SA (PRUEBA)",
  email: "",
  calle: "Av. Siempreviva 742",
  ciudad: "Mar del Plata",
  provincia: "AR-B",
};
const r = (o: Partial<Renglon>): Renglon => ({
  productoId: null,
  descripcion: "Malbec Reserva 750",
  cantidad: 1,
  precioUnitarioCentavos: 1_500_000,
  descuentoPct: 0,
  alcanzado: true,
  ...o,
});

const casos: {
  nombre: string;
  receptor: DatosReceptor;
  renglones: Renglon[];
  percepcionIva: boolean;
  formaPago: FormaPago;
  conNotaCredito?: boolean;
}[] = [
  {
    nombre: "B · un renglón con centavos, efectivo",
    receptor: cf,
    renglones: [r({ precioUnitarioCentavos: 1_234_567 })],
    percepcionIva: false,
    formaPago: "efectivo",
  },
  {
    nombre: "B · tres renglones con descuentos, transferencia",
    receptor: cf,
    renglones: [
      r({ cantidad: 6, descuentoPct: 10 }),
      r({
        descripcion: "Copa Riedel",
        cantidad: 2,
        precioUnitarioCentavos: 499_999,
        alcanzado: false,
      }),
      r({
        descripcion: "Espumante Brut",
        precioUnitarioCentavos: 1_234_567,
        descuentoPct: 12.5,
      }),
    ],
    percepcionIva: false,
    formaPago: "transferencia",
  },
  {
    nombre:
      "A · percepción IVA RG 5329 sobre parte de los renglones, débito, con su NC",
    receptor: ri,
    renglones: [
      r({ cantidad: 12, descuentoPct: 5 }),
      r({
        descripcion: "Copa Riedel",
        cantidad: 6,
        precioUnitarioCentavos: 499_999,
        alcanzado: false,
      }),
      r({
        descripcion: "Espumante Brut",
        cantidad: 3,
        precioUnitarioCentavos: 1_234_567,
      }),
    ],
    percepcionIva: true,
    formaPago: "debito",
    conNotaCredito: true,
  },
];

async function emitir(doc: ElectronicDocument, esperadoCentavos: number) {
  const res = await emitirEnFacturante(cfg!, doc);
  const p = parseDocumento(res);
  const facturante = Math.round(res.total * 100);
  console.log(`  → ${p.estado} ${p.numeroCompleto ?? ""} CAE ${p.cae ?? "—"}`);
  console.log(
    `  → total Facturante $${pesos(facturante)} · nuestro $${pesos(esperadoCentavos)} · ${
      facturante === esperadoCentavos
        ? "COINCIDE"
        : `DIFERENCIA ${facturante - esperadoCentavos} centavos`
    }`,
  );
  console.log(`  → PDF ${p.pdfUrl ?? "—"}`);
  return res;
}

async function main() {
  const dia = hoyEnArgentina();
  console.log(
    `Sandbox ${cfg.baseUrl} · company ${cfg.companyId} · POS ${cfg.posId} · ${aplicar ? "EMITIENDO" : "dry-run"}`,
  );

  for (const caso of casos) {
    console.log(`\n■ ${caso.nombre}`);
    const c = calcular(caso.renglones, { percepcionIva: caso.percepcionIva });
    const v = validarReceptor(caso.receptor, c.totalCentavos);
    if (!v.ok) throw new Error(v.error);
    console.log(
      `  neto $${pesos(c.netoCentavos)} · IVA $${pesos(c.ivaCentavos)} · percepciones ${
        c.percepciones
          .map((x) => `$${pesos(x.montoCentavos)} s/ $${pesos(x.baseCentavos)}`)
          .join(", ") || "—"
      } · total $${pesos(c.totalCentavos)}`,
    );
    const doc = mapFactura({
      letra: v.letra,
      receptor: v.receptor,
      renglones: caso.renglones,
      percepciones: c.percepciones,
      formaPago: caso.formaPago,
      dia,
      externalId: `gorros-sandbox-${randomUUID()}`,
      posId: cfg.posId,
    });
    if (!aplicar) {
      console.log(JSON.stringify([doc], null, 2));
      continue;
    }
    const res = await emitir(doc, c.totalCentavos);

    if (caso.conNotaCredito && parseDocumento(res).estado === "autorizado") {
      const numero = numeroDeComprobante(
        res,
        res.fiscalData?.fullNumber ?? null,
      );
      const prefijo = prefijoDeComprobante(
        res,
        res.fiscalData?.fullNumber ?? null,
      );
      if (!numero || !prefijo)
        throw new Error(
          "La respuesta no trae número o prefijo para asociar la NC.",
        );
      console.log(`\n■ NC de ${res.fiscalData.fullNumber}`);
      const nc = mapNotaCredito(
        doc,
        {
          posId: cfg.posId,
          posPrefix: prefijo,
          number: numero,
          cuitEmisor: cfg.emisorCuit,
          fecha: doc.header.detail.dates[0].dateTime,
        },
        { dia, externalId: `gorros-sandbox-nc-${randomUUID()}` },
      );
      await emitir(nc, c.totalCentavos);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
