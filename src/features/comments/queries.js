import { createClient } from "@/lib/supabase/server";

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
      body,
      created_at,
      updated_at
    `
    )
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (commentsError) {
    console.error("Error fetching comments:", commentsError);

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
    console.error("Error fetching comment authors:", profilesError);

    return {
      comments: comments.map((comment) => ({
        ...comment,
        author: null,
      })),
      error: null,
    };
  }

  const profilesById = new Map(
    (profiles || []).map((profile) => [profile.id, profile])
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