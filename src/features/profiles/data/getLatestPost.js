import { createClient } from "@/lib/supabase/server";

function isMissingSlugColumnError(error) {
  return (
    error?.code === "42703" &&
    `${error?.message || ""}`.includes("posts.slug")
  );
}

const LATEST_POST_SELECT = `
  id,
  slug,
  title,
  body,
  visibility,
  created_at
`;

const BASE_LATEST_POST_SELECT = `
  id,
  title,
  body,
  visibility,
  created_at
`;

async function fetchLatestPost({ supabase, userId, selectColumns }) {
  return supabase
    .from("posts")
    .select(selectColumns)
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}

export async function getLatestPost(userId) {
  const supabase = await createClient();

  let { data: latestPost, error } = await fetchLatestPost({
    supabase,
    userId,
    selectColumns: LATEST_POST_SELECT,
  });

  if (isMissingSlugColumnError(error)) {
    console.warn("POST SLUG COLUMN MISSING: retrying latest post without slug.");

    const fallbackResult = await fetchLatestPost({
      supabase,
      userId,
      selectColumns: BASE_LATEST_POST_SELECT,
    });

    latestPost = fallbackResult.data;
    error = fallbackResult.error;
  }

  if (error) {
    console.error("GET LATEST POST ERROR:", error);

    return {
      latestPost: null,
      error,
    };
  }

  return {
    latestPost,
    error: null,
  };
}
