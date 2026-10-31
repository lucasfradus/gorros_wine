/** Lo que manda Postgres cuando choca un unique: drizzle lo envuelve en `cause`. */
export function esDuplicado(e: unknown): boolean {
  const codigo = (x: unknown) => (x as { code?: string } | null | undefined)?.code;
  return codigo(e) === "23505" || codigo((e as { cause?: unknown } | null)?.cause) === "23505";
}
