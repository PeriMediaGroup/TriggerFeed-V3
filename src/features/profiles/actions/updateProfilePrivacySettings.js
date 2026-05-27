"use server";

import { createClient } from "@/lib/supabase/server";

const ALLOWED_KEYS = ["show_email", "show_city", "show_state"];

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

  const nextProfileVisibility = {};

  for (const key of ALLOWED_KEYS) {
    if (typeof profileVisibility?.[key] === "boolean") {
      nextProfileVisibility[key] = profileVisibility[key];
    }
  }

  if (Object.keys(nextProfileVisibility).length === 0) {
    return {
      success: false,
      message: "No valid privacy settings were provided.",
    };
  }

  const nextPrivacySettings = {
    profile_visibility: nextProfileVisibility,
  };

  const { error } = await supabase
    .from("profiles")
    .update({
      privacy_settings: nextPrivacySettings,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    console.error("UPDATE PROFILE PRIVACY SETTINGS ERROR:", error);

    return {
      success: false,
      message: "Could not update profile privacy settings.",
    };
  }

  return {
    success: true,
  };
}