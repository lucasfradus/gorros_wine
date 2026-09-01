/**
 * Pasa a la base los cuatro eventos que estaban escritos a mano en
 * `lib/data.ts` hasta la iteración del ABM.
 *
 *   node scripts/_eventos-seed.mjs          # dry-run: dice qué haría
 *   APPLY=1 node scripts/_eventos-seed.mjs  # escribe
 *
 * Existe por una razón concreta: producción muestra estos cuatro eventos ahora
 * mismo. Si la versión nueva se despliega con la tabla vacía, la página de
 * eventos queda pelada y la home pierde su bloque de fechas.
 *
 * One-off, con prefijo `_` y dry-run por defecto, como manda la convención de
 * `scripts/`. Una vez corrido en producción no hace falta nunca más, pero se
 * deja versionado: es el registro de de dónde salieron estas cuatro filas.
 *
 * JavaScript plano y SQL a mano, igual que `create-admin.mjs` y por el mismo
 * motivo: tiene que poder correr dentro del contenedor desplegado.
 */
import { existsSync } from "node:fs";
import pg from "pg";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

if (!process.env.DATABASE_URL) {
  console.error("\nFalta DATABASE_URL.");
  process.exit(1);
}

const APPLY = process.env.APPLY === "1";

/**
 * Los cuatro, tal como se veían.
 *
 * El `meta` original venía en una sola frase —"19:30 hs · Local Pilar · 8
 * etiquetas a ciegas"— y acá va partido en los campos que ahora existen. Dos
 * de ellos no aclaraban el lugar: va "Local Pilar", que es donde son.
 *
 * De la frase original se perdieron por el camino el horario y el precio: la
 * tabla dejó de guardarlos, porque ninguno de los dos se usaba.
 */
const EVENTOS = [
  {
    titulo: "Cata de Malbecs de altura",
    comienza: "2026-07-18",
    lugar: "Local Pilar",
    detalle: "8 etiquetas a ciegas",
  },
  {
    titulo: "Espumantes & quesos",
    comienza: "2026-08-02",
    lugar: "Local Pilar",
    detalle: "con sommelier invitada",
  },
  {
    titulo: "Iniciación al vino",
    comienza: "2026-08-16",
    lugar: "Local Pilar",
    detalle: "para arrancar sin vueltas",
  },
  {
    titulo: "Noche de Patagonia",
    comienza: "2026-08-30",
    lugar: "Local Pilar",
    detalle: "Pinot y Merlot del sur",
  },
];

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

try {
  console.log(
    APPLY
      ? "\nEscribiendo los eventos…\n"
      : "\nDry-run. Para escribir de verdad: APPLY=1 node scripts/_eventos-seed.mjs\n",
  );

  let nuevos = 0;
  let existentes = 0;

  for (const e of EVENTOS) {
    // Idempotencia sin constraint en la tabla: título más fecha alcanzan como
    // clave natural para estas cuatro filas. La tabla no la lleva porque dos
    // catas homónimas en horarios distintos son legítimas.
    const { rows } = await pool.query(
      "SELECT id FROM eventos WHERE titulo = $1 AND comienza = $2",
      [e.titulo, e.comienza],
    );

    if (rows.length > 0) {
      existentes++;
      console.log(`  = ya está: ${e.titulo}`);
      continue;
    }

    nuevos++;
    console.log(`  ${APPLY ? "+" : "·"} ${e.titulo} — ${e.comienza}`);

    if (APPLY) {
      await pool.query(
        `INSERT INTO eventos
           (titulo, comienza, lugar, detalle, publicado)
         VALUES ($1, $2, $3, $4, true)`,
        [e.titulo, e.comienza, e.lugar, e.detalle],
      );
    }
  }

  console.log(
    `\n${APPLY ? "✓ Escritos" : "Se escribirían"}: ${nuevos}. Ya existían: ${existentes}.`,
  );

  if (!APPLY && nuevos > 0) {
    console.log("No se tocó la base. Corré con APPLY=1 para hacerlo.");
  }
} catch (err) {
  if (err.code === "42P01") {
    console.error("\nLa tabla `eventos` no existe. Corré `npm run db:migrate`.");
  } else {
    console.error(`\nNo se pudo sembrar:\n${err}`);
  }
  process.exit(1);
} finally {
  await pool.end();
}
