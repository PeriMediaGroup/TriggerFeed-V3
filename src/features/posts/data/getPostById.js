// src/features/posts/data/getPostById.js

import { createClient } from "@/lib/supabase/server";

export async function getPostById(postId) {
  const supabase = await createClient();

  const { data: post, error: postError } = await supabase
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
      updated_at,
      post_media (
        id,
        media_type,
        provider,
        cloudinary_url,
        cloudinary_secure_url,
        cloudinary_public_id,
        width,
        height,
        alt_text,
        sort_order
      )
    `
    )
    .eq("id", postId)
    .eq("is_deleted", false)
    .single();

  if (postError || !post) {
    return {
      post: null,
      error: postError,
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      `
      id,
      username,
      first_name
    `
    )
    .eq("id", post.user_id)
    .maybeSingle();

  if (profileError) {
    console.error("GET POST AUTHOR ERROR:", profileError);
  }

  return {
    post: {
      ...post,
      media: post.post_media || [],
      author: profile || null,
    },
    error: null,
  };
}