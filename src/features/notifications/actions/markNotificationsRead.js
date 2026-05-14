"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function markNotificationsRead() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      message: "You must be logged in.",
      updatedCount: 0,
    };
  }

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("notifications")
    .update({
      is_read: true,
      read_at: now,
    })
    .eq("user_id", user.id)
    .eq("is_read", false)
    .is("dismissed_at", null)
    .select("id");

  if (error) {
    console.error("MARK NOTIFICATIONS READ ERROR:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    return {
      success: false,
      message: "Could not mark notifications as read.",
      updatedCount: 0,
    };
  }

  const updatedCount = data?.length ?? 0;

  console.log("MARK NOTIFICATIONS READ SUCCESS:", {
    userId: user.id,
    updatedCount,
  });

  revalidatePath("/profile");
  revalidatePath("/profile/notifications");

  return {
    success: true,
    updatedCount,
  };
}