import { createClient } from "@/lib/supabase/server";

function normalizeProfile(profile) {
  if (!profile) {
    return null;
  }

  return {
    ...profile,
    profile_image_url: profile.avatar_cloudinary_url,
  };
}

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
      first_name,
      last_name,
      display_name,
      avatar_cloudinary_url,
      banner_cloudinary_url,
      profile_badge,
      city,
      state,
      bio,
      created_at,
      updated_at
    `
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching profile:", {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
    });

    return {
      profile: null,
      error: error.message,
    };
  }

  return {
    profile: normalizeProfile(data),
    error: null,
  };
}
