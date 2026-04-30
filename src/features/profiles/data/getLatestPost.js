import { createClient } from "@/lib/supabase/server";

export async function getLatestPost(userId) {
  const supabase = await createClient();

  const { data: latestPost, error } = await supabase
    .from("posts")
    .select(
      `
      id,
      title,
      body,
      visibility,
      created_at
    `
    )
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

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