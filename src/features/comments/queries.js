import { createClient } from "@/lib/supabase/server";

function normalizeAuthor(profile) {
  if (!profile) {
    return null;
  }

  return {
    ...profile,
    profile_image_url: profile.avatar_cloudinary_url,
  };
}

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

export async function getCommentsByPostId(postId) {
  if (!postId) {
    return {
      comments: [],
      error: "Missing post id",
    };
  }

  const supabase = await createClient();

  const { data: comments, error: commentsError } = await supabase
    .from("comments")
    .select(
      `
    id,
    post_id,
    user_id,
    parent_comment_id,
    body,
    is_deleted,
    deleted_at,
    created_at,
    updated_at
    `,
    )
    .eq("post_id", postId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: true });

  if (commentsError) {
    logSupabaseError("Error fetching comments:", commentsError);

    return {
      comments: [],
      error: commentsError.message,
    };
  }

  if (!comments?.length) {
    return {
      comments: [],
      error: null,
    };
  }

  const userIds = [...new Set(comments.map((comment) => comment.user_id))];

  const { data: profiles, error: profilesError } = await supabase.rpc(
    "get_public_profile_cards",
    {
      p_profile_ids: userIds,
    },
  );

  if (profilesError) {
    logSupabaseError("Error fetching comment authors:", profilesError);

    return {
      comments: comments.map((comment) => ({
        ...comment,
        author: null,
      })),
      error: null,
    };
  }

  const profilesById = new Map(
    (profiles || []).map((profile) => [profile.id, normalizeAuthor(profile)]),
  );

  const commentsWithAuthors = comments.map((comment) => ({
    ...comment,
    author: profilesById.get(comment.user_id) || null,
  }));

  return {
    comments: commentsWithAuthors,
    error: null,
  };
}
