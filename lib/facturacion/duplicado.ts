/** Lo que manda Postgres cuando choca un unique: drizzle lo envuelve en `cause`. */
export function esDuplicado(e: unknown): boolean {
  const codigo = (x: unknown) => (x as { code?: string } | null | undefined)?.code;
  return codigo(e) === "23505" || codigo((e as { cause?: unknown } | null)?.cause) === "23505";
}

/** Qué índice chocó, para decir el porqué: no es lo mismo un doble clic que
 *  un documento que ya tiene factura. */
export function indiceDuplicado(e: unknown): string | undefined {
  const r = e as { constraint?: string; cause?: { constraint?: string } } | null;
  return r?.constraint ?? r?.cause?.constraint;
}
