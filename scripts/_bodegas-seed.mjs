/**
 * Carga las bodegas del catálogo, con su logo, desde `_bodegas-seed.json`.
 *
 *   node scripts/_bodegas-seed.mjs          # dry-run: dice qué haría
 *   APPLY=1 node scripts/_bodegas-seed.mjs  # escribe
 *
 * Existe porque las bodegas son datos del negocio que no salen de ningún lado:
 * los logos los mandó cada proveedor y están en un Drive, y el resto se cargó a
 * mano. Sin este script, poblar producción sería repetir el trabajo entero en
 * el panel, una bodega por vez.
 *
 * One-off, con prefijo `_` y dry-run por defecto, como manda la convención de
 * `scripts/` y como ya hace `_eventos-seed.mjs`.
 *
 * **Los datos no están acá adentro, están en `_bodegas-seed.json`.** Este
 * archivo es la lógica; el manifiesto es el material. Se separan porque el
 * manifiesto lo genera un helper después de subir los logos por el gateway, y
 * porque así se puede revisar de un vistazo qué se va a cargar.
 *
 * JavaScript plano y SQL a mano, igual que `create-admin.mjs` y
 * `_eventos-seed.mjs`, y por el mismo motivo: tiene que poder correr dentro del
 * contenedor desplegado sin depender de las dependencias de desarrollo.
 */
import { existsSync, readFileSync } from "node:fs";
import pg from "pg";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

if (!process.env.DATABASE_URL) {
  console.error("\nFalta DATABASE_URL.");
  process.exit(1);
}

const APPLY = process.env.APPLY === "1";
const MANIFIESTO = "scripts/_bodegas-seed.json";

if (!existsSync(MANIFIESTO)) {
  console.error(`\nFalta ${MANIFIESTO}.`);
  process.exit(1);
}

/**
 * Cada entrada trae la bodega y, si tiene logo, los datos del archivo que ya
 * está en el bucket.
 *
 * `media` y `logo` están separados a propósito, aunque se pisen en parte:
 * `media` es la fila del inventario —la que mira `/media/[...key]` para decidir
 * si sirve el archivo— y `logo` es lo que guarda la bodega, desnormalizado,
 * que es como lo guardan también el CMS y la agenda de eventos.
 */
const BODEGAS = JSON.parse(readFileSync(MANIFIESTO, "utf8"));

const destino = (() => {
  try {
    const u = new URL(process.env.DATABASE_URL);
    return `${u.hostname}:${u.port || 5432}${u.pathname}`;
  } catch {
    return "(no se pudo leer el host)";
  }
})();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

/** Los bytes ya están en el bucket; acá va sólo la fila que los habilita. */
async function insertarMedia(cliente, media) {
  await cliente.query(
    `insert into media (key, mime, bytes, width, height, original_name)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (key) do nothing`,
    [
      media.key,
      media.mime,
      media.bytes,
      media.width,
      media.height,
      media.originalName ?? null,
    ],
  );
}

async function insertarBodega(cliente, b) {
  await cliente.query(
    `insert into bodegas (slug, nombre, logo, pais, sitio_web)
     values ($1, $2, $3, $4, $5)
     on conflict (slug) do nothing`,
    [b.slug, b.nombre, b.logo ? JSON.stringify(b.logo) : null, b.pais ?? null, b.sitioWeb ?? null],
  );
}

try {
  console.log(`\n${APPLY ? "Cargando" : "Dry-run contra"} ${destino}\n`);

  const { rows: existentes } = await pool.query(
    "select slug from bodegas where slug = any($1)",
    [BODEGAS.map((b) => b.slug)],
  );
  const yaEstan = new Set(existentes.map((r) => r.slug));

  let nuevas = 0;
  let salteadas = 0;
  let sinLogo = 0;

  for (const b of BODEGAS) {
    if (yaEstan.has(b.slug)) {
      console.log(`  = ${b.nombre} — ya existe, se saltea`);
      salteadas++;
      continue;
    }

    const nota = b.logo ? "" : "  (sin logo)";
    if (!b.logo) sinLogo++;
    console.log(`  + ${b.nombre}${nota}`);
    nuevas++;

    if (!APPLY) continue;

    // Cada bodega en su propia transacción: si una falla por un dato raro, las
    // anteriores quedan cargadas y el script se puede volver a correr.
    const cliente = await pool.connect();
    try {
      await cliente.query("begin");
      if (b.media) await insertarMedia(cliente, b.media);
      await insertarBodega(cliente, b);
      await cliente.query("commit");
    } catch (err) {
      await cliente.query("rollback");
      throw new Error(`Falló ${b.nombre}: ${err.message}`, { cause: err });
    } finally {
      cliente.release();
    }
  }

  console.log(
    `\n${nuevas} para cargar (${sinLogo} sin logo), ${salteadas} ya estaban.`,
  );
  if (!APPLY) console.log("Nada se escribió. Repetí con APPLY=1.\n");
  else console.log("Listo.\n");
} catch (err) {
  console.error(`\nFalló contra ${destino}:\n`, err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
