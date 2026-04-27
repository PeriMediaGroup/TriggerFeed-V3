// src/features/posts/data/getPosts.js

import { createClient } from "@/lib/supabase/server";

export async function getPosts() {
  const supabase = await createClient();

  const { data: posts, error: postsError } = await supabase
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

  if (postsError) {
    console.error("GET POSTS ERROR:", postsError);

    return {
      posts: [],
      error: postsError,
    };
  }

  const safePosts = posts || [];

  if (!safePosts.length) {
    return {
      posts: [],
      error: null,
    };
  }

  const userIds = [...new Set(safePosts.map((post) => post.user_id))];

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select(
      `
      id,
      username,
      first_name
    `
    )
    .in("id", userIds);

  if (profilesError) {
    console.error("GET POST PROFILES ERROR:", profilesError);

    return {
      posts: safePosts.map((post) => ({
        ...post,
        author: null,
      })),
      error: null,
    };
  }

  const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));

  const postsWithAuthors = safePosts.map((post) => ({
    ...post,
    author: profileMap.get(post.user_id) || null,
  }));

  return {
    posts: postsWithAuthors,
    error: null,
  };
}