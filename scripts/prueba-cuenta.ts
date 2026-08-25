import {
  conSigno,
  patasDeConversion,
  aDeltas,
  saldoDe,
  gruposAnulados,
  conOperacionesJuntas,
  excedidoDelLimite,
  importeACentavos,
  convertir,
} from "../lib/cuenta-corriente.ts";
import { formatARS, formatUSD } from "../lib/format.ts";

let fallos = 0;
const ok = (q: string, real: unknown, esperado: unknown) => {
  const bien = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bien) fallos++;
  console.log(
    bien ? "  ok  " : " FALLA",
    q,
    bien
      ? ""
      : `\n        real=${JSON.stringify(real)}\n        esp.=${JSON.stringify(esperado)}`,
  );
};

type S = { arsCentavos: number; usdCentavos: number };
const fila = (s: S, grupoId: string, anulaGrupoId: string | null = null) => ({
  ...aDeltas(s),
  grupoId,
  anulaGrupoId,
});

console.log("\n— El caso real: debe 5M, deja USD 2.000 a 1.200, luego USD 2.000 a favor —");

const cargo = fila(conSigno(5_000_000_00, "ARS", false), "g1");
const pago = fila(conSigno(2_000_00, "USD", true), "g2");
const aplic = fila(patasDeConversion(2_000_00, "USD", 1200), "g2");
const favor = fila(conSigno(2_000_00, "USD", true), "g3");

ok("el cargo le sube la deuda en pesos", cargo.deltaArsCentavos, -5_000_000_00);
ok("el pago entra como dolares a favor", pago.deltaUsdCentavos, 2_000_00);
ok("aplicarlo saca los dolares...", aplic.deltaUsdCentavos, -2_000_00);
ok("...y baja la deuda en pesos", aplic.deltaArsCentavos, 2_400_000_00);

const extracto = [cargo, pago, aplic, favor];
const s = saldoDe(extracto);
console.log(`  saldo -> ${formatARS(s.arsCentavos)} | ${formatUSD(s.usdCentavos)}`);
ok("debe $2.600.000", s.arsCentavos, -2_600_000_00);
ok("a favor USD 2.000", s.usdCentavos, 2_000_00);

console.log("\n— Anular el pago devuelve todo a como estaba —");
const anul = [
  fila(
    { arsCentavos: -pago.deltaArsCentavos, usdCentavos: -pago.deltaUsdCentavos },
    "g4",
    "g2",
  ),
  fila(
    { arsCentavos: -aplic.deltaArsCentavos, usdCentavos: -aplic.deltaUsdCentavos },
    "g4",
    "g2",
  ),
];
const s2 = saldoDe([...extracto, ...anul]);
console.log(`  saldo -> ${formatARS(s2.arsCentavos)} | ${formatUSD(s2.usdCentavos)}`);
ok("vuelve a deber los 5M", s2.arsCentavos, -5_000_000_00);
ok("le quedan los 2.000 del otro dia", s2.usdCentavos, 2_000_00);
ok(
  "se tachan las dos patas y la anulacion",
  [...gruposAnulados([...extracto, ...anul])].sort(),
  ["g2", "g4"],
);

console.log("\n— Conversion al reves: pasar deuda en pesos a dolares —");
const p = patasDeConversion(1_200_000_00, "ARS", 1200);
ok("saca 1.200.000 pesos", p.arsCentavos, -1_200_000_00);
ok("y pone USD 1.000", p.usdCentavos, 1_000_00);

console.log("\n— Redondeo al centavo —");
ok("USD 33,33 a 1234,56 = $41.147,88", convertir(33_33, "USD", 1234.56), 41_147_88);
ok("no quedan fracciones", Number.isInteger(convertir(1, "ARS", 3)), true);

console.log("\n— Limite de credito —");
ok(
  "debe 5M con limite 3M -> excedido 2M",
  excedidoDelLimite(
    { limiteArsCentavos: 3_000_000_00, limiteUsdCentavos: null },
    { arsCentavos: -5_000_000_00, usdCentavos: 0 },
  ).arsCentavos,
  2_000_000_00,
);
ok(
  "sin limite nunca excede",
  excedidoDelLimite(
    { limiteArsCentavos: null, limiteUsdCentavos: null },
    { arsCentavos: -9_000_000_00, usdCentavos: 0 },
  ).arsCentavos,
  0,
);
ok(
  "saldo a favor no excede",
  excedidoDelLimite(
    { limiteArsCentavos: 100, limiteUsdCentavos: null },
    { arsCentavos: 5_000_00, usdCentavos: 0 },
  ).arsCentavos,
  0,
);

console.log("\n— Importes tipeados a mano —");
ok('"5.000.000"', importeACentavos("5.000.000"), 5_000_000_00);
ok('"5000000"', importeACentavos("5000000"), 5_000_000_00);
ok('"1.234,56"', importeACentavos("1.234,56"), 1_234_56);
ok('"1234.56"', importeACentavos("1234.56"), 1_234_56);
ok('"1.500" son mil quinientos', importeACentavos("1.500"), 1_500_00);
ok('"$ 2.000"', importeACentavos("$ 2.000"), 2_000_00);
ok('"USD 2000"', importeACentavos("USD 2000"), 2_000_00);
ok("vacio", importeACentavos(""), null);
ok('"abc"', importeACentavos("abc"), null);
ok('"1,2,3"', importeACentavos("1,2,3"), null);

console.log(fallos === 0 ? "\nTODO OK\n" : `\n${fallos} FALLAS\n`);
process.exit(fallos === 0 ? 0 : 1);

