// src/features/posts/data/getPostById.js

import { createClient } from "@/lib/supabase/server";

export async function getPostById(postId) {
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
      is_deleted,
      created_at,
      updated_at
    `
    )
    .eq("id", postId)
    .eq("is_deleted", false)
    .single();

  if (error) {
    return {
      post: null,
      error,
    };
  }

  return {
    post: data,
    error: null,
  };
}