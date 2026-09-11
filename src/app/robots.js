import { SITE_URL } from "@/lib/site";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/posts"],
      disallow: [
        "/admin",
        "/api",
        "/auth",
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
    sitemap: new URL("/sitemap.xml", SITE_URL).toString(),
  };
}
