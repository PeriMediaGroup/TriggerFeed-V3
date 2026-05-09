// src/features/posts/data/getPosts.js

import { createClient } from "@/lib/supabase/server";

export async function getPosts() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

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
    .eq("is_deleted", false)
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .order("sort_order", {
      referencedTable: "post_media",
      ascending: true,
    })
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

  // -----------------------------
  // Comment counts
  // -----------------------------
  const { data: comments, error: commentsError } = await supabase
    .from("comments")
    .select("post_id")
    .in("post_id", postIds)
    .eq("is_deleted", false)
    .is("parent_comment_id", null);

  if (commentsError) {
    console.error("GET POST COMMENT COUNTS ERROR:", commentsError);
  }

  const commentCountMap = new Map();

  for (const comment of comments || []) {
    const currentCount = commentCountMap.get(comment.post_id) || 0;
    commentCountMap.set(comment.post_id, currentCount + 1);
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
    .in("post_id", postIds);

  if (voteCountsError) {
    console.error("GET POST VOTE COUNTS ERROR:", voteCountsError);
  }

  const voteCountMap = new Map(
    (voteCounts || []).map((voteCount) => [voteCount.post_id, voteCount])
  );

  // -----------------------------
  // Current user's votes
  // This controls active up/down button state
  // -----------------------------
  let currentUserVotes = [];

  if (user) {
    const { data: userVotes, error: userVotesError } = await supabase
      .from("post_votes")
      .select("post_id, vote_type")
      .eq("user_id", user.id)
      .in("post_id", postIds);

    if (userVotesError) {
      console.error("GET CURRENT USER POST VOTES ERROR:", userVotesError);
    }

    currentUserVotes = userVotes || [];
  }

  const currentUserVoteMap = new Map(
    currentUserVotes.map((vote) => [vote.post_id, vote.vote_type])
  );

  // -----------------------------
  // Authors
  // -----------------------------
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
      posts: safePosts.map((post) => {
        const voteCountsForPost = voteCountMap.get(post.id);

        return {
          ...post,
          media: post.post_media || [],
          author: null,
          comment_count: commentCountMap.get(post.id) || 0,
          upvote_count: voteCountsForPost?.upvote_count || 0,
          downvote_count: voteCountsForPost?.downvote_count || 0,
          interaction_count: voteCountsForPost?.interaction_count || 0,
          score: voteCountsForPost?.score || 0,
          current_user_vote: currentUserVoteMap.get(post.id) || null,
        };
      }),
      error: null,
    };
  }

  const profileMap = new Map(
    (profiles || []).map((profile) => [profile.id, profile])
  );

  const postsWithAuthors = safePosts.map((post) => {
    const voteCountsForPost = voteCountMap.get(post.id);

    return {
      ...post,
      media: post.post_media || [],
      author: profileMap.get(post.user_id) || null,
      comment_count: commentCountMap.get(post.id) || 0,
      upvote_count: voteCountsForPost?.upvote_count || 0,
      downvote_count: voteCountsForPost?.downvote_count || 0,
      interaction_count: voteCountsForPost?.interaction_count || 0,
      score: voteCountsForPost?.score || 0,
      current_user_vote: currentUserVoteMap.get(post.id) || null,
    };
  });

  return {
    posts: postsWithAuthors,
    error: null,
  };
}