import type { Cliente, MovimientoCc } from "@/lib/db/schema";

/**
 * Las reglas de la cuenta corriente, en un solo lugar y **sin tocar la base**.
 *
 * Mismo corte que hay entre `lib/auth/permissions.ts` y `lib/auth/session.ts`:
 * acá viven las decisiones —qué es un saldo, qué signo lleva un cargo, cómo se
 * convierte a la cotización pactada— y en `lib/db/cuenta.ts` las consultas.
 *
 * Que no haya I/O no es prolijidad: es lo que permite ejercitar la aritmética
 * de la plata sin levantar Postgres, y que las mismas reglas valgan igual desde
 * una página, una Server Action o un script.
 */

/**
 * Las dos monedas del módulo. Es un tipo de TypeScript y **no** un enum de
 * Postgres: ninguna columna guarda una moneda, porque los importes viven en
 * `deltaArsCentavos` y `deltaUsdCentavos` por separado. Sirve para los
 * formularios, que sí necesitan preguntar "¿en qué moneda?".
 */
export const MONEDAS = ["ARS", "USD"] as const;
export type Moneda = (typeof MONEDAS)[number];

/**
 * El saldo, con el signo mirado desde el cliente: **positivo es a favor,
 * negativo es deuda**. Las dos monedas conviven y ninguna se convierte a la
 * otra sola.
 */
export interface Saldo {
  arsCentavos: number;
  usdCentavos: number;
}

/**
 * Un importe tipeado a mano, pasado a centavos. `null` si no se entiende.
 *
 * Se acepta lo que la gente realmente escribe —"5.000.000", "5000000",
 * "1.234,56", "$ 1234.56"— porque el que carga la cuenta viene de un cuaderno,
 * no de un formulario contable.
 *
 * El punto es ambiguo y se resuelve por la cantidad de dígitos: "1.500" son mil
 * quinientos (miles, como se escribe acá) y "1.50" es uno con cincuenta. Con
 * coma no hay duda: la coma siempre decide los decimales.
 *
 * Se redondea al centavo porque `Number("1234.56") * 100` da 123455.99999999999
 * y truncar eso perdería un centavo por operación.
 */
export function importeACentavos(entrada: string): number | null {
  const limpio = entrada.replace(/usd|ars/gi, "").replace(/[\s$]/g, "");
  if (limpio === "") return null;

  let normalizado: string;
  if (limpio.includes(",")) {
    normalizado = limpio.replace(/\./g, "").replace(",", ".");
  } else {
    const partes = limpio.split(".");
    const pareceDecimal = partes.length === 2 && partes[1].length <= 2;
    normalizado = pareceDecimal ? limpio : limpio.replace(/\./g, "");
  }

  if (!/^-?\d+(\.\d{1,2})?$/.test(normalizado)) return null;

  const centavos = Math.round(Number(normalizado) * 100);
  // Más allá de esto se sale de los enteros exactos de JavaScript, y un saldo
  // que no se puede sumar sin error no sirve para nada.
  if (!Number.isSafeInteger(centavos)) return null;
  return centavos;
}

export const SALDO_CERO: Saldo = { arsCentavos: 0, usdCentavos: 0 };

type Delta = Pick<MovimientoCc, "deltaArsCentavos" | "deltaUsdCentavos">;

/**
 * El saldo es la suma de los movimientos. No hay nada más.
 *
 * Fijate que **no filtra los anulados**, y no es un olvido: anular agrega la
 * operación inversa, así que el original y su contramovimiento se cancelan
 * solos al sumar. Filtrarlos daría el mismo número con más código y una forma
 * nueva de equivocarse.
 */
export function saldoDe(movimientos: Delta[]): Saldo {
  return movimientos.reduce<Saldo>(
    (acc, m) => ({
      arsCentavos: acc.arsCentavos + m.deltaArsCentavos,
      usdCentavos: acc.usdCentavos + m.deltaUsdCentavos,
    }),
    SALDO_CERO,
  );
}

export function tieneDeuda(saldo: Saldo): boolean {
  return saldo.arsCentavos < 0 || saldo.usdCentavos < 0;
}

/**
 * Los `grupoId` de las operaciones anuladas, para tacharlas en el extracto.
 *
 * Anular es puramente visual —el saldo ya está bien sin esto— y por eso se
 * resuelve en memoria sobre los movimientos que la ficha cargó igual, en vez de
 * pegarle otra vez a la base.
 *
 * Devuelve los dos lados: la operación anulada **y** la que la anula, porque
 * mostrar una tachada y la otra normal haría parecer que el saldo se movió.
 */
export function gruposAnulados(
  movimientos: Pick<MovimientoCc, "grupoId" | "anulaGrupoId">[],
): Set<string> {
  const anulados = new Set<string>();
  for (const m of movimientos) {
    if (m.anulaGrupoId) {
      anulados.add(m.anulaGrupoId);
      anulados.add(m.grupoId);
    }
  }
  return anulados;
}

/**
 * Reordena el extracto para que las filas de una misma operación queden juntas
 * y en un orden previsible.
 *
 * Hace falta porque las dos patas de un pago aplicado se escriben en el mismo
 * `INSERT`: comparten `fecha` y `created_at` **exactos**, así que ordenar por
 * esas columnas no decide nada entre ellas y Postgres puede devolverlas en
 * cualquier orden. Agrupar por adyacencia sobre eso funcionaba de casualidad.
 *
 * Dentro de una operación, la conversión va después de lo que la originó: se
 * lee "recibí USD 2.000" y recién ahí "lo apliqué a la deuda en pesos", que es
 * el orden en que pasaron las cosas.
 *
 * El `Map` conserva el orden de aparición, así que las operaciones quedan como
 * vinieron de la base.
 */
export function conOperacionesJuntas<
  T extends { grupoId: string; tipo: string },
>(movimientos: T[]): T[] {
  const porGrupo = new Map<string, T[]>();

  for (const m of movimientos) {
    const filas = porGrupo.get(m.grupoId);
    if (filas) filas.push(m);
    else porGrupo.set(m.grupoId, [m]);
  }

  return [...porGrupo.values()]
    .map((filas) =>
      filas.length === 1
        ? filas
        : [...filas].sort(
            (a, b) =>
              Number(a.tipo === "conversion") - Number(b.tipo === "conversion"),
          ),
    )
    .flat();
}

/**
 * Cuánto se pasó del límite, por moneda. `0` es que no se pasó.
 *
 * El límite se compara contra la deuda de **su** moneda y nunca contra el
 * total: el sistema no tiene un tipo de cambio de referencia con el que sumar
 * peras y manzanas, y inventar uno acá sería usarlo para decidir plata.
 */
export function excedidoDelLimite(
  cliente: Pick<Cliente, "limiteArsCentavos" | "limiteUsdCentavos">,
  saldo: Saldo,
): Saldo {
  const exceso = (limite: number | null, centavos: number) => {
    if (limite === null || centavos >= 0) return 0;
    return Math.max(0, -centavos - limite);
  };

  return {
    arsCentavos: exceso(cliente.limiteArsCentavos, saldo.arsCentavos),
    usdCentavos: exceso(cliente.limiteUsdCentavos, saldo.usdCentavos),
  };
}

/* ────────────────  cómo se arma cada movimiento  ──────────────── */

/**
 * Un importe convertido a la otra moneda, a la cotización pactada.
 *
 * `cotizacion` son pesos por dólar. Como los dos importes están en centavos, la
 * cuenta sale directa en las dos direcciones. Se redondea al centavo: es plata
 * que alguien va a leer en un extracto, no puede quedar con catorce decimales.
 */
export function convertir(
  centavos: number,
  desde: Moneda,
  cotizacion: number,
): number {
  return desde === "USD"
    ? Math.round(centavos * cotizacion)
    : Math.round(centavos / cotizacion);
}

/**
 * Las dos patas de una conversión: sale de una moneda y entra en la otra.
 *
 * Sirve igual para aplicar un saldo a favor contra la deuda y para pasar una
 * deuda de moneda. Son la misma operación; lo único que cambia es de qué lado
 * estaba el saldo antes, y eso el modelo no lo tiene que saber.
 */
export function patasDeConversion(
  centavos: number,
  desde: Moneda,
  cotizacion: number,
): Saldo {
  const convertido = convertir(centavos, desde, cotizacion);
  return desde === "USD"
    ? { arsCentavos: convertido, usdCentavos: -centavos }
    : { arsCentavos: -centavos, usdCentavos: convertido };
}

/** El importe con el signo puesto según a quién favorece, en su moneda. */
export function conSigno(
  centavos: number,
  moneda: Moneda,
  aFavorDelCliente: boolean,
): Saldo {
  const firmado = aFavorDelCliente ? centavos : -centavos;
  return moneda === "ARS"
    ? { arsCentavos: firmado, usdCentavos: 0 }
    : { arsCentavos: 0, usdCentavos: firmado };
}

/** Pasa un `Saldo` a las columnas de `movimientos_cc`. */
export function aDeltas(saldo: Saldo) {
  return {
    deltaArsCentavos: saldo.arsCentavos,
    deltaUsdCentavos: saldo.usdCentavos,
  };
}
