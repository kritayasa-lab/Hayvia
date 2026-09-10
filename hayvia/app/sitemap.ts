import type { MetadataRoute } from "next";
import { properties } from "@/data/properties";
import { guides } from "@/data/guides";
import { contactConfig } from "@/config/contact";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = contactConfig.siteUrl;

  const staticRoutes = [
    "",
    "/properties",
    "/get-matched",
    "/guide",
    "/about",
    "/list-your-property",
    "/contact",
  ].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
  }));

  const propertyRoutes = properties.map((p) => ({
    url: `${base}/properties/${p.slug}`,
    lastModified: new Date(),
  }));

  const guideRoutes = guides.map((g) => ({
    url: `${base}/guide/${g.slug}`,
    lastModified: new Date(g.date),
  }));

  return [...staticRoutes, ...propertyRoutes, ...guideRoutes];
}
