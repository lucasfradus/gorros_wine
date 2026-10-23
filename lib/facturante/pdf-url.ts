/**
 * Link al PDF forzado a https. Facturante lo devuelve a veces con `http://`
 * contra el mismo host, y el navegador avisa "sitio no seguro" al abrirlo.
 */
export function urlPdfComprobante(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.replace(/^http:\/\//i, "https://");
}
