/**
 * El tope de peso de una subida, en un archivo que pueden leer los dos lados.
 *
 * Lo aplica `uploadMediaAction` —que es donde vale, porque es el servidor— y
 * también el campo del panel antes de mandar nada. No es celo: por encima del
 * `bodySizeLimit` de `next.config.mjs` la Server Action **no llega a correr**,
 * así que si el único control estuviera en el servidor el mensaje no habría
 * forma de mostrarlo. Y de paso nadie sube 30 MB para que recién entonces le
 * digan que no.
 *
 * Vive acá y no en `imagen.ts` porque ese módulo importa sharp, que no puede
 * entrar en un bundle de cliente; ni en la action, porque un archivo
 * `"use server"` sólo puede exportar funciones asíncronas.
 */
export const MAX_MB_SUBIDA = 10;

export const MAX_BYTES_SUBIDA = MAX_MB_SUBIDA * 1024 * 1024;

/** El mismo texto de un lado y del otro, para que no se contradigan. */
export function mensajeDemasiadoPesada(bytes: number): string {
  const mb = (bytes / 1024 / 1024).toFixed(1);
  return `La imagen pesa ${mb} MB y el máximo son ${MAX_MB_SUBIDA} MB. Si salió de una cámara, exportala más chica.`;
}
