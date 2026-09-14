import { createClient } from "@/lib/supabase/server";
import { getProfileBadges } from "@/features/profiles/data/getProfileBadges";

function normalizeProfile(profile, badges = []) {
  if (!profile) {
    return null;
  }

  return {
    ...profile,
    badges,
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

  const { badgesByProfileId } = await getProfileBadges(supabase, [data?.id]);

  return {
    profile: normalizeProfile(data, badgesByProfileId.get(data?.id) || []),
    error: null,
  };
}
