/**
 * Crea (o recupera) el usuario dueño.
 *
 *   npm run admin:crear
 *   npm run admin:crear -- "Lucas Fradus" lucas@gorroswine.com
 *
 * Es el único usuario que no se puede dar de alta desde el panel, por el
 * problema del huevo y la gallina: sin nadie adentro, nadie puede invitar.
 *
 * Si el mail ya existe, en vez de fallar le pone una contraseña nueva, lo
 * reactiva y lo deja como dueño. Ésa es la salida de emergencia para el día
 * en que el dueño se quede afuera de su propio sistema.
 *
 * La contraseña sale de ADMIN_PASSWORD si está definida; si no, se genera una
 * al azar y se imprime una sola vez. No se pide por teclado a propósito: lo
 * tipeado queda en el historial de la terminal.
 */
import { existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

/** Sin ambigüedad visual: nada de l/I/1 ni O/0. */
const ALFABETO = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generarPassword(largo = 16): string {
  const bytes = randomBytes(largo);
  let out = "";
  for (let i = 0; i < largo; i++) out += ALFABETO[bytes[i] % ALFABETO.length];
  return out;
}

async function main() {
  // Importación dinámica: lib/db exige DATABASE_URL al cargarse, y con un
  // import estático se evaluaría antes del loadEnvFile de arriba.
  const { eq } = await import("drizzle-orm");
  const { db } = await import("../lib/db");
  const { users } = await import("../lib/db/schema");
  const { hashPassword, normalizeEmail } = await import("../lib/auth/password");
  const { MIN_PASSWORD_LENGTH } = await import("../lib/auth/constants");

  const [argNombre, argEmail] = process.argv.slice(2);

  let nombre = argNombre;
  let email = argEmail;

  if (!nombre || !email) {
    const rl = createInterface({ input: stdin, output: stdout });
    nombre ||= (await rl.question("Nombre y apellido: ")).trim();
    email ||= (await rl.question("Mail: ")).trim();
    rl.close();
  }

  if (!nombre || !email) {
    console.error("\nFaltan el nombre o el mail.");
    process.exit(1);
  }

  email = normalizeEmail(email);

  const password = process.env.ADMIN_PASSWORD || generarPassword();
  const generada = !process.env.ADMIN_PASSWORD;

  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(
      `\nADMIN_PASSWORD tiene que tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    );
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);

  const [existente] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existente) {
    await db
      .update(users)
      .set({
        name: nombre,
        passwordHash,
        role: "owner",
        isActive: true,
        failedAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existente.id));

    console.log(`\n✓ ${email} ya existía: se restableció como dueño activo.`);
  } else {
    await db
      .insert(users)
      .values({ name: nombre, email, passwordHash, role: "owner" });

    console.log(`\n✓ Dueño creado: ${nombre} <${email}>`);
  }

  if (generada) {
    console.log(`\n  Contraseña: ${password}`);
    console.log("  Se muestra una sola vez. Cambiala al entrar, en Mi cuenta.");
  }

  console.log("\n  Ingresá en http://localhost:3000/admin\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("\nNo se pudo crear el usuario:\n", err);
  process.exit(1);
});
