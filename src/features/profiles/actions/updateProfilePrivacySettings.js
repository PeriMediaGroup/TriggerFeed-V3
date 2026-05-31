"use server";

import { createClient } from "@/lib/supabase/server";
import { normalizeProfilePrivacySettings } from "@/features/profiles/lib/privacySettings";

const ALLOWED_KEYS = ["show_email", "show_city", "show_state", "show_real_name"];

function logSupabaseError(label, error) {
  console.error(label, {
    raw: error,
    name: error?.name,
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
    status: error?.status,
  });
}

export async function updateProfilePrivacySettings(profileVisibility) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      message: "You must be logged in to update profile privacy settings.",
    };
  }

  const incomingProfileVisibility = {};

  for (const key of ALLOWED_KEYS) {
    if (typeof profileVisibility?.[key] === "boolean") {
      incomingProfileVisibility[key] = profileVisibility[key];
    }
  }

  if (Object.keys(incomingProfileVisibility).length === 0) {
    return {
      success: false,
      message: "No valid privacy settings were provided.",
    };
  }

  const { data: currentProfile, error: currentProfileError } = await supabase
    .rpc("get_my_profile")
    .maybeSingle();

  if (currentProfileError) {
    logSupabaseError(
      "GET CURRENT PROFILE PRIVACY SETTINGS ERROR:",
      currentProfileError,
    );

    return {
      success: false,
      message: "Could not load current profile privacy settings.",
    };
  }

  const currentPrivacySettings = normalizeProfilePrivacySettings(
    currentProfile?.privacy_settings,
  );

  const nextPrivacySettings = normalizeProfilePrivacySettings({
    profile_visibility: {
      ...currentPrivacySettings.profile_visibility,
      ...incomingProfileVisibility,
    },
  });

  const { error } = await supabase
    .from("profiles")
    .update({
      privacy_settings: nextPrivacySettings,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    logSupabaseError("UPDATE PROFILE PRIVACY SETTINGS ERROR:", error);

    return {
      success: false,
      message: "Could not update profile privacy settings.",
    };
  }

  return {
    success: true,
  };
}
