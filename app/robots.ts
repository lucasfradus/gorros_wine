import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Privadas del usuario: no aportan nada a la búsqueda.
      disallow: ["/carrito", "/cuenta", "/buscar"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
