import { createClient } from "@/lib/supabase/server";

export async function getProfileStats(userId) {
  const supabase = await createClient();

  const { count: postCount, error: postsError } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_deleted", false);

  if (postsError) {
    console.error("GET PROFILE POST COUNT ERROR:", {
      code: postsError.code,
      message: postsError.message,
      details: postsError.details,
      hint: postsError.hint,
    });
  }

  const { data: friendCount, error: friendCountError } = await supabase.rpc(
    "get_profile_friend_count",
    {
      target_user_id: userId,
    },
  );

  if (friendCountError) {
    console.error("GET PROFILE FRIEND COUNT ERROR:", {
      code: friendCountError.code,
      message: friendCountError.message,
      details: friendCountError.details,
      hint: friendCountError.hint,
    });
  }

  return {
    stats: {
      posts: postCount || 0,
      friends: friendCount || 0,
    },
    error: postsError || friendCountError || null,
  };
}