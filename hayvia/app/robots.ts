import type { MetadataRoute } from "next";
import { contactConfig } from "@/config/contact";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${contactConfig.siteUrl}/sitemap.xml`,
  };
}
