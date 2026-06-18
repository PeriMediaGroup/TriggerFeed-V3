// src/features/posts/data/getPostById.js

import { createClient } from "@/lib/supabase/server";
import { getMentionProfilesForText } from "@/features/mentions/data/getMentionProfilesForText";
import { normalizePostMedia } from "@/features/media/normalizePostMedia";

function getDeletedAuthor(userId) {
  return {
    id: userId,
    username: null,
    display_name: "Deleted User",
    first_name: null,
    last_name: null,
    avatar_cloudinary_url: null,
    profile_badge: null,
    city: null,
    state: null,
    is_deleted: true,
  };
}

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
        display_order,
        created_at
      ),
      polls (
        id,
        question,
        allows_multiple,
        poll_options (
          id,
          option_text,
          display_order
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
  // Aggregate vote counts. Raw post_votes rows and the backing view are not client-readable.
  // -----------------------------
  const { data: voteCountRows, error: voteCountsError } = await supabase.rpc(
    "get_post_vote_counts",
    {
      p_post_ids: [postId],
    }
  );

  const voteCounts = voteCountRows?.[0] ?? null;

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

  const pollIds = (post.polls || []).map((poll) => poll.id).filter(Boolean);
  let pollResults = [];
  let myPollResponses = [];

  if (pollIds.length > 0) {
    const { data: results, error: pollResultsError } = await supabase.rpc(
      "get_poll_results",
      {
        p_poll_ids: pollIds,
      }
    );

    if (pollResultsError) {
      console.error("GET POST POLL RESULTS ERROR:", {
        code: pollResultsError.code,
        message: pollResultsError.message,
        details: pollResultsError.details,
        hint: pollResultsError.hint,
      });
    }

    pollResults = results || [];

    if (user) {
      const { data: responses, error: myResponsesError } = await supabase.rpc(
        "get_my_poll_responses",
        {
          p_poll_ids: pollIds,
        }
      );

      if (myResponsesError) {
        console.error("GET MY POST POLL RESPONSES ERROR:", {
          code: myResponsesError.code,
          message: myResponsesError.message,
          details: myResponsesError.details,
          hint: myResponsesError.hint,
        });
      }

      myPollResponses = responses || [];
    }
  }

  const pollResultsByPollId = new Map();

  for (const result of pollResults) {
    const resultsForPoll = pollResultsByPollId.get(result.poll_id) || [];
    resultsForPoll.push(result);
    pollResultsByPollId.set(result.poll_id, resultsForPoll);
  }

  const myPollResponseMap = new Map(
    myPollResponses.map((response) => [response.poll_id, response.option_id])
  );

  return {
    post: {
      ...post,
      polls: (post.polls || []).map((poll) => ({
        ...poll,
        poll_results: pollResultsByPollId.get(poll.id) || [],
        my_option_id: myPollResponseMap.get(poll.id) || null,
      })),
      media: normalizePostMedia(post.post_media),
      author: profile || getDeletedAuthor(post.user_id),
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
