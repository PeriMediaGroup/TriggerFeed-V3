import { createClient } from "@/lib/supabase/server";

export async function getProfileStats(userId) {
  const supabase = await createClient();

  const { count: postCount, error: postsError } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_deleted", false);

  if (postsError) {
    console.error("GET PROFILE POST COUNT ERROR:", postsError);
  }

  const { count: friendCountA, error: friendsAError } = await supabase
    .from("friends")
    .select("id", { count: "exact", head: true })
    .eq("requester_id", userId)
    .eq("status", "accepted");

  if (friendsAError) {
    console.error("GET PROFILE FRIEND COUNT A ERROR:", friendsAError);
  }

  const { count: friendCountB, error: friendsBError } = await supabase
    .from("friends")
    .select("id", { count: "exact", head: true })
    .eq("addressee_id", userId)
    .eq("status", "accepted");

  if (friendsBError) {
    console.error("GET PROFILE FRIEND COUNT B ERROR:", friendsBError);
  }

  return {
    stats: {
      posts: postCount || 0,
      friends: (friendCountA || 0) + (friendCountB || 0),
    },
    error: postsError || friendsAError || friendsBError || null,
  };
}