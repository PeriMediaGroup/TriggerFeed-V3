import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

const sitemapUrl = new URL("/sitemap.xml", SITE_URL).toString();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/posts/"],
      disallow: [
        "/admin/",
        "/api/",
        "/auth/",
        "/delete-account",
        "/forgot-password",
        "/login",
        "/logout",
        "/onboarding",
        "/profile",
        "/reset-password",
        "/signup",
      ],
    },
    sitemap: sitemapUrl,
  };
}
