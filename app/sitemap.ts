import type { MetadataRoute } from "next";
import { wines } from "@/lib/data";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPaths = [
    { path: "/", priority: 1 },
    { path: "/catalogo", priority: 0.9 },
    { path: "/eventos", priority: 0.7 },
    { path: "/nosotros", priority: 0.7 },
    { path: "/club", priority: 0.7 },
    { path: "/terminos", priority: 0.2 },
    { path: "/privacidad", priority: 0.2 },
  ];

  return [
    ...staticPaths.map((p) => ({
      url: `${siteUrl}${p.path}`,
      priority: p.priority,
    })),
    ...wines.map((w) => ({
      url: `${siteUrl}/producto/${w.id}`,
      priority: 0.6,
    })),
  ];
}
