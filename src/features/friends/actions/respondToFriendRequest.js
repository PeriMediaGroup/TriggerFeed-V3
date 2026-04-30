// src/features/friends/actions/respondToFriendRequest.js

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function respondToFriendRequest(friendRequestId, response) {
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

  if (!["accepted", "declined"].includes(response)) {
    return {
      success: false,
      message: "Invalid response.",
    };
  }

  const { error } = await supabase
    .from("friends")
    .update({
      status: response,
      updated_at: new Date().toISOString(),
    })
    .eq("id", friendRequestId)
    .eq("addressee_id", user.id)
    .eq("status", "pending");

  if (error) {
    console.error("RESPOND FRIEND REQUEST ERROR:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    return {
      success: false,
      message: "Could not update friend request.",
    };
  }

  revalidatePath("/friends");

  return {
    success: true,
    message: response === "accepted" ? "Friend request accepted." : "Friend request declined.",
  };
}