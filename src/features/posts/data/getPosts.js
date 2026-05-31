// src/features/posts/data/getPosts.js

import { createClient } from "@/lib/supabase/server";
import { getMentionProfilesForText } from "@/features/mentions/data/getMentionProfilesForText";
import { getCommentsByPostId } from "@/features/comments/queries";

const POST_SELECT = `
  id,
  user_id,
  title,
  body,
  visibility,
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
`;

function logSupabaseError(label, error) {
  console.error(label, {
    raw: error,
    name: error?.name,
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
    status: error?.status,
  });
}

export async function getPosts({ feedType = "main" } = {}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const currentUserId = user?.id ?? null;

  if (feedType === "friends" && !currentUserId) {
    return {
      posts: [],
      commentsByPostId: {},
      currentUserId,
      message: "Log in to see posts from friends.",
      error: null,
    };
  }

  let message = "";
  let allowedUserIds = null;

  if (feedType === "friends") {
    const friendResult = await getAcceptedFriendIds(supabase, currentUserId);

    if (friendResult.error) {
      return {
        posts: [],
        commentsByPostId: {},
        currentUserId,
        message: "Could not load your friends feed.",
        error: friendResult.error,
      };
    }

    allowedUserIds = [currentUserId, ...friendResult.friendIds];

    if (friendResult.friendIds.length === 0) {
      message =
        "You do not have friend posts yet. Go make some friends. Horrifying, but useful.";
    }
  }

  let query = supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("is_deleted", false)
    .eq("visibility", "public");

  if (feedType === "friends" && allowedUserIds?.length) {
    query = query.in("user_id", allowedUserIds);
  }

  if (feedType === "trending") {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    query = query.gte("created_at", sevenDaysAgo.toISOString());
  }

  query = query
    .order("created_at", { ascending: false })
    .order("sort_order", {
      referencedTable: "post_media",
      ascending: true,
    })
    .limit(50);

  const { data: posts, error: postsError } = await query;

  if (postsError) {
    logSupabaseError("GET POSTS ERROR:", postsError);

    return {
      posts: [],
      commentsByPostId: {},
      currentUserId,
      message: "Could not load posts.",
      error: postsError,
    };
  }

  const safePosts = posts || [];

  if (!safePosts.length) {
    return {
      posts: [],
      commentsByPostId: {},
      currentUserId,
      message,
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
    logSupabaseError("GET POST COMMENT COUNTS ERROR:", commentsError);
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
    logSupabaseError("GET POST VOTE COUNTS ERROR:", voteCountsError);
  }

  const voteCountMap = new Map(
    (voteCounts || []).map((voteCount) => [voteCount.post_id, voteCount])
  );

  // -----------------------------
  // Current user's votes
  // -----------------------------
  let currentUserVotes = [];

  if (currentUserId) {
    const { data: userVotes, error: userVotesError } = await supabase.rpc(
      "get_my_post_votes",
      {
        p_post_ids: postIds,
      }
    );

    if (userVotesError) {
      logSupabaseError("GET CURRENT USER POST VOTES ERROR:", userVotesError);
    }

    currentUserVotes = userVotes || [];
  }

  const currentUserVoteMap = new Map(
    currentUserVotes.map((vote) => [vote.post_id, vote.user_vote])
  );

  // -----------------------------
  // Authors
  // -----------------------------
  const userIds = [...new Set(safePosts.map((post) => post.user_id))];

  const { data: profiles, error: profilesError } = await supabase.rpc(
    "get_public_profile_cards",
    {
      p_profile_ids: userIds,
    }
  );

  if (profilesError) {
    logSupabaseError("GET POST PROFILES ERROR:", profilesError);
  }

  const profileMap = new Map(
    (profiles || []).map((profile) => [profile.id, profile])
  );

  const postsWithAuthors = await Promise.all(
    safePosts.map(async (post) => {
      const voteCountsForPost = voteCountMap.get(post.id);

      const mentionProfiles = await getMentionProfilesForText(
        `${post.title || ""} ${post.body || ""}`
      );

      return {
        ...post,
        media: post.post_media || [],
        author: profileMap.get(post.user_id) || null,
        mentionProfiles,
        comment_count: commentCountMap.get(post.id) || 0,
        upvote_count: voteCountsForPost?.upvote_count || 0,
        downvote_count: voteCountsForPost?.downvote_count || 0,
        interaction_count: voteCountsForPost?.interaction_count || 0,
        score: voteCountsForPost?.score || 0,
        current_user_vote: currentUserVoteMap.get(post.id) || null,
      };
    })
  );

  // -----------------------------
  // Inline comments for feed toggle
  // -----------------------------
  const commentResults = await Promise.all(
    postsWithAuthors.map(async (post) => {
      const { comments: postComments } = await getCommentsByPostId(post.id);

      return {
        postId: post.id,
        comments: postComments || [],
      };
    })
  );

  const commentsByPostId = commentResults.reduce((grouped, result) => {
    grouped[result.postId] = result.comments;
    return grouped;
  }, {});

  const finalPosts =
    feedType === "trending"
      ? [...postsWithAuthors].sort((a, b) => {
        const aScore =
          (a.score || 0) * 2 +
          (a.comment_count || 0) +
          (a.interaction_count || 0);

        const bScore =
          (b.score || 0) * 2 +
          (b.comment_count || 0) +
          (b.interaction_count || 0);

        return bScore - aScore;
      })
      : postsWithAuthors;

  return {
    posts: finalPosts,
    commentsByPostId,
    currentUserId,
    message,
    error: null,
  };
}

async function getAcceptedFriendIds(supabase, currentUserId) {
  const { data: friendships, error } = await supabase
    .from("friends")
    .select("requester_id, addressee_id, status")
    .or(`requester_id.eq.${currentUserId},addressee_id.eq.${currentUserId}`)
    .eq("status", "accepted");

  if (error) {
    logSupabaseError("GET ACCEPTED FRIEND IDS ERROR:", error);

    return {
      friendIds: [],
      error,
    };
  }

  const friendIds = (friendships || [])
    .map((friendship) => {
      if (friendship.requester_id === currentUserId) {
        return friendship.addressee_id;
      }

      return friendship.requester_id;
    })
    .filter(Boolean);

  return {
    friendIds,
    error: null,
  };
}
