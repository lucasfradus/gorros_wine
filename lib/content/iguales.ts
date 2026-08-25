/**
 * Igualdad profunda entre dos valores de contenido.
 *
 * La usan los dos lados por el mismo motivo —saber si un campo sigue igual al
 * original del registro—: el panel para marcarlo como editado, y la action
 * para decidir si guarda la fila o la borra. Tienen que coincidir, así que
 * viven en un solo lugar.
 *
 * No sirve comparar con `JSON.stringify`: el orden de las claves depende de
 * cómo se armó el objeto, y un ítem de lista que vuelve del navegador no tiene
 * por qué traerlas en el mismo orden que el registro.
 */
export function iguales(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (typeof a !== "object") return false;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    return a.every((x, i) => iguales(x, b[i]));
  }

  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;

  return ka.every(
    (k) =>
      Object.hasOwn(b as object, k) &&
      iguales(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
      ),
  );
}
