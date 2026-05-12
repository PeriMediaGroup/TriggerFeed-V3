import { createClient } from "@/lib/supabase/server";

export async function getMentionedProfiles(usernames = []) {
  const supabase = await createClient();

  const cleanUsernames = Array.from(
    new Set(
      usernames
        .filter(Boolean)
        .map((username) => username.trim().toLowerCase())
    )
  );

  if (cleanUsernames.length === 0) {
    return {
      profiles: [],
      error: null,
    };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username")
    .in("username_lower", cleanUsernames);

  if (error) {
    return {
      profiles: [],
      error,
    };
  }

  return {
    profiles: data || [],
    error: null,
  };
}