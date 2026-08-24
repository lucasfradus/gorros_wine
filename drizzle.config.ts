import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// drizzle-kit corre fuera de Next, así que .env.local no se carga solo.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
  verbose: true,
  strict: true,
});
