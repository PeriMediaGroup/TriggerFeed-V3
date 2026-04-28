import { createClient } from "@/lib/supabase/server";

export async function getProfileById(userId) {
  if (!userId) {
    return {
      profile: null,
      error: "Missing user id",
    };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select(
      `
      id,
      username,
      email,
      first_name,
      last_name,
      avatar_cloudinary_url,
      banner_cloudinary_url,
      role,
      is_banned,
      is_muted,
      is_deleted,
      created_at,
      updated_at
    `
    )
    .eq("id", userId)
    .eq("is_deleted", false)
    .maybeSingle();

  if (error) {
    console.error("Error fetching profile:", error);

    return {
      profile: null,
      error: error.message,
    };
  }

  return {
    profile: data,
    error: null,
  };
}