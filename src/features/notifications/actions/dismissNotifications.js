"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function dismissNotification(notificationId) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      message: "You must be logged in.",
    };
  }

  if (!notificationId) {
    return {
      success: false,
      message: "Missing notification id.",
    };
  }

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("notifications")
    .update({
      is_read: true,
      read_at: now,
      dismissed_at: now,
    })
    .eq("id", notificationId)
    .eq("user_id", user.id)
    .is("dismissed_at", null);

  if (error) {
    console.error("DISMISS NOTIFICATION ERROR:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    return {
      success: false,
      message: "Could not dismiss notification.",
    };
  }

  revalidatePath("/profile");
  revalidatePath("/profile/notifications");

  return {
    success: true,
  };
}