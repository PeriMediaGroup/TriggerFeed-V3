import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

const sitemapUrl = new URL("/sitemap.xml", SITE_URL).toString();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: sitemapUrl,
  };
}
