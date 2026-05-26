"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { normalizeProfilePrivacySettings } from "@/features/profiles/lib/privacySettings";

export async function updateProfilePrivacySettings(_prevState, formData) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      message: "You must be logged in to update profile settings.",
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("privacy_settings")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("GET PROFILE PRIVACY SETTINGS ERROR:", {
      code: profileError.code,
      message: profileError.message,
      details: profileError.details,
      hint: profileError.hint,
    });

    return {
      success: false,
      message: "Could not load profile privacy settings.",
    };
  }

  const currentSettings = normalizeProfilePrivacySettings(
    profile?.privacy_settings,
  );

  const nextSettings = normalizeProfilePrivacySettings({
    ...currentSettings,
    profile_visibility: {
      ...currentSettings.profile_visibility,
      show_city: formData.get("show_city") === "on",
      show_state: formData.get("show_state") === "on",
      show_email: formData.get("show_email") === "on",
    },
  });

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      privacy_settings: nextSettings,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (updateError) {
    console.error("UPDATE PROFILE PRIVACY SETTINGS ERROR:", {
      code: updateError.code,
      message: updateError.message,
      details: updateError.details,
      hint: updateError.hint,
    });

    return {
      success: false,
      message: "Could not update profile privacy settings.",
    };
  }

  revalidatePath("/profile");
  revalidatePath(`/profiles/${user.id}`);

  return {
    success: true,
    message: "Profile privacy settings updated.",
  };
}
