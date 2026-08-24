/**
 * Aplica las migraciones pendientes de `drizzle/`.
 *
 * Es JavaScript plano y usa sólo dependencias de producción (`drizzle-orm` y
 * `pg`) a propósito: corre como `preDeployCommand` dentro de Railway, donde
 * `drizzle-kit` y `tsx` no existen porque son dependencias de desarrollo.
 *
 * Es el mismo camino en local y en producción —`npm run db:migrate`— así que
 * no hay dos formas de migrar que puedan divergir. `drizzle-kit` sigue siendo
 * el que *genera* el SQL (`npm run db:generate`); esto sólo lo aplica.
 *
 * Lleva la misma tabla de control que drizzle-kit (`__drizzle_migrations`), así
 * que es idempotente: si no hay nada pendiente, no hace nada.
 */
import { existsSync } from "node:fs";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

// En Railway las variables vienen del entorno. En local salen de .env.local, y
// `loadEnvFile` no pisa lo que ya esté definido: si alguien exporta otra
// DATABASE_URL, esa gana.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    "Falta DATABASE_URL. En local: copiá .env.example a .env.local y corré " +
      "`npm run db:up`.",
  );
  process.exit(1);
}

// El host sale en los mensajes; la contraseña, nunca.
const destino = (() => {
  try {
    const u = new URL(connectionString);
    return `${u.hostname}:${u.port || 5432}${u.pathname}`;
  } catch {
    return "(no se pudo leer el host)";
  }
})();

const pool = new pg.Pool({ connectionString, max: 1 });

try {
  console.log(`Migrando ${destino} …`);
  await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
  console.log("Migraciones al día.");
} catch (err) {
  console.error(`\nFalló la migración de ${destino}:\n`, err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
