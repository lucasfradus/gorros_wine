import bcrypt from "bcryptjs";

/**
 * Coste de bcrypt. 12 son ~250 ms por verificación en una máquina de hoy:
 * imperceptible al ingresar, carísimo para quien pruebe millones de
 * contraseñas contra un dump robado.
 */
const COST = 12;

export { MIN_PASSWORD_LENGTH } from "./constants";

/**
 * Hash de descarte. Cuando alguien intenta entrar con un mail que no existe
 * igual comparamos contra esto, para que el login tarde lo mismo exista o no
 * la cuenta. Si no, la diferencia de tiempo delata qué mails están dados de
 * alta.
 */
const DUMMY_HASH =
  "$2b$12$Gy76T9luBLWb7KvjFbWd2.AP31JrKjtBzc8xzcS6AMIplMFAoo.8C";

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Quema el mismo tiempo que una verificación real, y siempre falla. */
export async function burnTime(plain: string): Promise<void> {
  await bcrypt.compare(plain, DUMMY_HASH);
}

/** Normaliza el mail para que el UNIQUE de la base sea insensible a mayúsculas. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
