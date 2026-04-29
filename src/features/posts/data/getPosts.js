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

  const postIds = safePosts.map((post) => post.id);

  const { data: comments, error: commentsError } = await supabase
    .from("comments")
    .select("post_id")
    .in("post_id", postIds)
    .eq("is_deleted", false);

  if (commentsError) {
    console.error("GET POST COMMENT COUNTS ERROR:", commentsError);
  }

  const commentCountMap = new Map();

  for (const comment of comments || []) {
    const currentCount = commentCountMap.get(comment.post_id) || 0;
    commentCountMap.set(comment.post_id, currentCount + 1);
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
    comment_count: commentCountMap.get(post.id) || 0,
  }));

  return {
    posts: postsWithAuthors,
    error: null,
  };
}