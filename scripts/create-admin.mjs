/**
 * Crea (o recupera) un usuario admin.
 *
 *   npm run admin:crear
 *   npm run admin:crear -- "Lucas Fradus" lucas@gorroswine.com
 *
 * Es el único usuario que no se puede dar de alta desde el panel, por el
 * problema del huevo y la gallina: sin nadie adentro, nadie puede invitar.
 *
 * Si el mail ya existe, en vez de fallar le pone una contraseña nueva, lo
 * reactiva y lo deja como admin. Ésa es la salida de emergencia para el día
 * en que no quede ningún admin que pueda entrar al panel.
 *
 * La contraseña sale de ADMIN_PASSWORD si está definida; si no, se genera una
 * al azar y se imprime una sola vez. No se pide por teclado a propósito: lo
 * tipeado queda en el historial de la terminal.
 *
 * JavaScript plano y SQL a mano, igual que `migrate.mjs` y por el mismo
 * motivo: tiene que poder correr dentro del contenedor desplegado sin depender
 * de que las dependencias de desarrollo sobrevivan al build. El precio es no
 * usar `lib/db/schema.ts`; si cambian esas columnas, cambia este INSERT.
 */
import { existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import bcrypt from "bcryptjs";
import pg from "pg";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

/** Espejo de `lib/auth/constants.ts` y del coste de `lib/auth/password.ts`. */
const MIN_PASSWORD_LENGTH = 10;
const BCRYPT_COST = 12;

/** Sin ambigüedad visual: nada de l/I/1 ni O/0. */
const ALFABETO = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generarPassword(largo = 16) {
  const bytes = randomBytes(largo);
  let out = "";
  for (let i = 0; i < largo; i++) out += ALFABETO[bytes[i] % ALFABETO.length];
  return out;
}

function salir(mensaje) {
  console.error(`\n${mensaje}`);
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  salir(
    "Falta DATABASE_URL. En local: copiá .env.example a .env.local y corré " +
      "`npm run db:up`.",
  );
}

const [argNombre, argEmail] = process.argv.slice(2);
let nombre = argNombre;
let email = argEmail;

if (!nombre || !email) {
  const rl = createInterface({ input: stdin, output: stdout });
  if (!nombre) nombre = (await rl.question("Nombre y apellido: ")).trim();
  if (!email) email = (await rl.question("Mail: ")).trim();
  rl.close();
}

if (!nombre || !email) salir("Faltan el nombre o el mail.");

// Igual que `normalizeEmail` en lib/auth/password.ts: el UNIQUE de la tabla es
// sensible a mayúsculas, así que se normaliza antes de escribir.
email = email.trim().toLowerCase();

const password = process.env.ADMIN_PASSWORD || generarPassword();
const generada = !process.env.ADMIN_PASSWORD;

if (password.length < MIN_PASSWORD_LENGTH) {
  salir(
    `ADMIN_PASSWORD tiene que tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
  );
}

const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

try {
  // `xmax = 0` es cero sólo en la fila recién insertada: distingue el alta de
  // la recuperación sin una consulta previa ni una condición de carrera.
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, is_active)
     VALUES ($1, $2, $3, 'admin', true)
     ON CONFLICT (email) DO UPDATE
        SET name            = EXCLUDED.name,
            password_hash   = EXCLUDED.password_hash,
            role            = 'admin',
            is_active       = true,
            failed_attempts = 0,
            locked_until    = NULL,
            updated_at      = now()
     RETURNING (xmax = 0) AS creado`,
    [nombre, email, passwordHash],
  );

  console.log(
    rows[0].creado
      ? `\n✓ Admin creado: ${nombre} <${email}>`
      : `\n✓ ${email} ya existía: se restableció como admin activo.`,
  );

  if (generada) {
    console.log(`\n  Contraseña: ${password}`);
    console.log("  Se muestra una sola vez. Cambiala al entrar, en Mi cuenta.");
  }
} catch (err) {
  if (err.code === "42P01") {
    salir(
      "La tabla `users` no existe. Corré `npm run db:migrate` antes de crear " +
        "el admin.",
    );
  }
  salir(`No se pudo crear el usuario:\n${err}`);
} finally {
  await pool.end();
}
