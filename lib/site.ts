/**
 * URL pública del sitio. Se usa para el sitemap, robots y las tarjetas de
 * Open Graph, que necesitan URLs absolutas.
 *
 * En producción hay que definir NEXT_PUBLIC_SITE_URL (por ejemplo
 * https://gorroswine.com.ar); si no, se cae al localhost de desarrollo.
 */
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");
