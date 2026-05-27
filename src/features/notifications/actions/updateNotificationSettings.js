"use server";

import { createClient } from "@/lib/supabase/server";

const ALLOWED_KEYS = [
  "mentions_enabled",
  "comments_enabled",
  "friend_requests_enabled",
  "friend_accepts_enabled",
];

export async function updateNotificationSettings(notificationSettings) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      message: "You must be logged in to update notification settings.",
    };
  }

  const updates = {};

  for (const key of ALLOWED_KEYS) {
    if (typeof notificationSettings?.[key] === "boolean") {
      updates[key] = notificationSettings[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return {
      success: false,
      message: "No valid notification settings were provided.",
    };
  }

  const timestamp = new Date().toISOString();

  const { data: updatedRows, error: updateError } = await supabase
    .from("notification_settings")
    .update({
      ...updates,
      updated_at: timestamp,
    })
    .eq("user_id", user.id)
    .select("user_id");

  if (updateError) {
    console.error("UPDATE NOTIFICATION SETTINGS ERROR:", updateError);

    return {
      success: false,
      message: "Could not update notification settings.",
    };
  }

  if (updatedRows?.length > 0) {
    return {
      success: true,
    };
  }

  const { error: insertError } = await supabase
    .from("notification_settings")
    .insert({
      user_id: user.id,
      ...updates,
      created_at: timestamp,
      updated_at: timestamp,
    });

  if (insertError) {
    console.error("INSERT NOTIFICATION SETTINGS ERROR:", insertError);

    return {
      success: false,
      message: "Could not update notification settings.",
    };
  }

  return {
    success: true,
  };
}