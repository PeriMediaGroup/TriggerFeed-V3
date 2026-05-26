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
    .rpc("get_public_profile", {
      p_profile_id: userId,
    })
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
