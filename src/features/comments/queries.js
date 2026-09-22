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

function getDeletedAuthor(userId) {
  return {
    id: userId,
    username: null,
    display_name: "Deleted User",
    first_name: null,
    last_name: null,
    avatar_cloudinary_url: null,
    profile_image_url: null,
    is_deleted: true,
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
  return getCommentsByPostIds(postId ? [postId] : []);
}

export async function getCommentsByPostIds(postIds) {
  if (!postIds?.length) {
    return {
      comments: [],
      error: "Missing post id",
    };
  }

  const supabase = await createClient();

  const comments = [];
  let commentsError = null;
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
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
    .in("post_id", postIds)
    .eq("is_deleted", false)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .range(offset, offset + 999);

    if (error) { commentsError = error; break; }
    comments.push(...(data || []));
    if (!data || data.length < 1000) break;
  }

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

  const authorResults = await Promise.all(
    Array.from({ length: Math.ceil(userIds.length / 500) }, (_, index) =>
      supabase.rpc("get_public_profile_cards", {
        p_profile_ids: userIds.slice(index * 500, (index + 1) * 500),
      })
    )
  );
  const profilesError = authorResults.find((result) => result.error)?.error;
  const profiles = authorResults.flatMap((result) => result.data || []);

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
    author: profilesById.get(comment.user_id) || getDeletedAuthor(comment.user_id),
  }));

  return {
    comments: commentsWithAuthors,
    error: null,
  };
}
