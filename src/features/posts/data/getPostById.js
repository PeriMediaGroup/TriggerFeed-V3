// src/features/posts/data/getPostById.js

import { createClient } from "@/lib/supabase/server";
import { getMentionProfilesForText } from "@/features/mentions/data/getMentionProfilesForText";

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
      is_sticky,
      sticky_at,
      sticky_by,
      created_at,
      updated_at,
      post_media (
        id,
        post_id,
        user_id,
        media_type,
        provider,
        source,
        cloudinary_url,
        cloudinary_secure_url,
        cloudinary_public_id,
        external_id,
        external_url,
        thumbnail_url,
        title,
        width,
        height,
        alt_text,
        sort_order,
        display_order
      ),
      polls (
        id,
        question,
        allows_multiple,
        poll_options (
          id,
          option_text,
          display_order
        ),
        poll_responses (
          id,
          option_id,
          user_id
        )
      )
    `
    )
    .eq("id", postId)
    .eq("is_deleted", false)
    .single();

  if (postError || !post) {
    return {
      post: null,
      currentUserRole: null,
      error: postError,
    };
  }

  let currentUserRole = null;

  if (user) {
    const { data: authStatus, error: authStatusError } = await supabase
      .rpc("get_my_profile_auth_status")
      .single();

    if (authStatusError) {
      console.error("GET CURRENT USER AUTH STATUS ERROR:", {
        code: authStatusError.code,
        message: authStatusError.message,
        details: authStatusError.details,
        hint: authStatusError.hint,
      });
    }

    currentUserRole = authStatus?.role || null;
  }

  const { data: profile, error: profileError } = await supabase
    .rpc("get_public_profile", {
      p_profile_id: post.user_id,
    })
    .maybeSingle();

  if (profileError) {
    console.error("GET POST AUTHOR ERROR:", {
      code: profileError?.code,
      message: profileError?.message,
      details: profileError?.details,
      hint: profileError?.hint,
    });
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
  // This controls active up/down button state.
  // Uses RPC so direct post_votes reads stay locked down.
  // -----------------------------
  let currentUserVote = null;

  if (user) {
    const { data: userVotes, error: userVoteError } = await supabase.rpc(
      "get_my_post_votes",
      {
        p_post_ids: [postId],
      }
    );

    if (userVoteError) {
      console.error("GET CURRENT USER POST VOTE ERROR:", {
        code: userVoteError.code,
        message: userVoteError.message,
        details: userVoteError.details,
        hint: userVoteError.hint,
      });
    }

    currentUserVote = userVotes?.[0]?.user_vote || null;
  }

  const mentionProfiles = await getMentionProfilesForText(
    `${post.title || ""} ${post.body || ""}`
  );

  return {
    post: {
      ...post,
      media: post.post_media || [],
      author: profile || null,
      mentionProfiles,
      upvote_count: voteCounts?.upvote_count || 0,
      downvote_count: voteCounts?.downvote_count || 0,
      interaction_count: voteCounts?.interaction_count || 0,
      score: voteCounts?.score || 0,
      current_user_vote: currentUserVote,
    },
    currentUserRole,
    error: null,
  };
}
