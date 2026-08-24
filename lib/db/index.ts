import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "Falta DATABASE_URL. Copiá .env.example a .env.local y levantá la base " +
      "con `docker compose up -d`.",
  );
}

/**
 * En desarrollo Next recarga los módulos con cada cambio de archivo. Sin este
 * caché en `globalThis` se abriría un pool nuevo por recarga hasta agotar las
 * conexiones de Postgres.
 */
const globalForDb = globalThis as unknown as { gorrosPool?: Pool };

const pool = globalForDb.gorrosPool ?? new Pool({ connectionString, max: 10 });

if (process.env.NODE_ENV !== "production") {
  globalForDb.gorrosPool = pool;
}

export const db = drizzle(pool, { schema });
export { schema };
