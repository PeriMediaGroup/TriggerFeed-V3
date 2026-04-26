// src/features/posts/data/getPosts.js

import { createClient } from "@/lib/supabase/server";

export async function getPosts() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("posts")
    .select(
      `
      id,
      user_id,
      title,
      body,
      visibility,
      created_at,
      updated_at
    `
    )
    .eq("is_deleted", false)
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return {
      posts: [],
      error,
    };
  }

  return {
    posts: data || [],
    error: null,
  };
}