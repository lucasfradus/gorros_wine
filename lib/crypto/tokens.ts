import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Cifrado en reposo de los tokens OAuth de Mercado Pago (AES-256-GCM).
 *
 * Con el access token se leen todos los cobros de la cuenta del local: un dump
 * de la base, o un backup que se filtra, no tiene que alcanzar para eso. La
 * clave vive sólo en el entorno (`MP_TOKEN_ENCRYPTION_KEY`, 32 bytes en hex).
 *
 * Formato `v1:iv:tag:cifrado`, todo en base64. El prefijo de versión deja
 * cambiar de algoritmo algún día sin migrar en caliente. Es el mismo formato
 * que Clicnet, sin su fallback a texto plano: acá nunca hubo tokens sin cifrar
 * y un payload que no descifra es un error, no un token viejo.
 */

const ALGO = "aes-256-gcm";
const VERSION = "v1";

function clave(): Buffer {
  const hex = process.env.MP_TOKEN_ENCRYPTION_KEY;
  if (!hex || !/^[0-9a-f]{64}$/i.test(hex)) {
    throw new Error("MP_TOKEN_ENCRYPTION_KEY falta o no son 32 bytes en hex");
  }
  return Buffer.from(hex, "hex");
}

export function cifrarToken(plano: string): string {
  if (!plano) throw new Error("cifrarToken: token vacío");
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, clave(), iv);
  const cifrado = Buffer.concat([cipher.update(plano, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv, tag, cifrado]
    .map((p) => (typeof p === "string" ? p : p.toString("base64")))
    .join(":");
}

export function descifrarToken(payload: string): string {
  const [version, iv, tag, cifrado, ...resto] = payload.split(":");
  if (version !== VERSION || !iv || !tag || !cifrado || resto.length > 0) {
    throw new Error("descifrarToken: payload con formato inválido");
  }
  const decipher = createDecipheriv(ALGO, clave(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(cifrado, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
