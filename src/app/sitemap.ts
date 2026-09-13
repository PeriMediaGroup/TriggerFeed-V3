import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/site";

const STATIC_PUBLIC_PATHS = [
  "/",
  "/welcome",
  "/about",
  "/contact",
  "/install",
  "/legal",
  "/merch",
  "/founding-500",
];

type SitemapPost = {
  slug: string | null;
  title: string | null;
  updated_at: string | null;
  created_at: string | null;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  const staticPages = STATIC_PUBLIC_PATHS.map((path) => ({
    url: new URL(path, SITE_URL).toString(),
  }));

  const { data: posts, error } = await supabase
    .from("posts")
    .select("slug,title,updated_at,created_at")
    .eq("is_deleted", false)
    .eq("visibility", "public")
    .not("slug", "is", null)
    .order("updated_at", { ascending: false })
    .limit(50000)
    .returns<SitemapPost[]>();

  if (error) {
    console.error("SITEMAP POSTS ERROR:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    return staticPages;
  }

  const safePosts: SitemapPost[] = posts || [];

  const postPages = safePosts
    .filter((post) => post.slug && `${post.title || ""}`.trim())
    .map((post) => ({
      url: new URL(`/posts/${post.slug}`, SITE_URL).toString(),
      lastModified: post.updated_at || post.created_at || undefined,
    }));

  return [...staticPages, ...postPages];
}
