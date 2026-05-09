// src/features/posts/data/getPostById.js

import { createClient } from "@/lib/supabase/server";

export async function getPostById(postId) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  // -----------------------------
  // Vote counts from SQL view
  // -----------------------------
  const { data: voteCounts, error: voteCountsError } = await supabase
    .from("post_vote_counts")
    .select(
      `
      post_id,
      upvote_count,
      downvote_count,
      interaction_count,
      score
    `
    )
    .eq("post_id", postId)
    .maybeSingle();

  if (voteCountsError) {
    console.error("GET POST VOTE COUNTS ERROR:", voteCountsError);
  }

  // -----------------------------
  // Current user's vote
  // This controls active up/down button state
  // -----------------------------
  let currentUserVote = null;

  if (user) {
    const { data: userVote, error: userVoteError } = await supabase
      .from("post_votes")
      .select("vote_type")
      .eq("post_id", postId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (userVoteError) {
      console.error("GET CURRENT USER POST VOTE ERROR:", userVoteError);
    }

    currentUserVote = userVote?.vote_type || null;
  }

  return {
    post: {
      ...post,
      media: post.post_media || [],
      author: profile || null,
      upvote_count: voteCounts?.upvote_count || 0,
      downvote_count: voteCounts?.downvote_count || 0,
      interaction_count: voteCounts?.interaction_count || 0,
      score: voteCounts?.score || 0,
      current_user_vote: currentUserVote,
    },
    error: null,
  };
}