// src/features/friends/actions/sendFriendRequest.js

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function sendFriendRequest(addresseeId) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      message: "You must be logged in to send a friend request.",
    };
  }

  if (!addresseeId || addresseeId === user.id) {
    return {
      success: false,
      message: "Invalid friend request.",
    };
  }

  const { data: existing, error: existingError } = await supabase
    .from("friends")
    .select("id, status")
    .or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${addresseeId}),and(requester_id.eq.${addresseeId},addressee_id.eq.${user.id})`
    )
    .maybeSingle();

  if (existingError) {
    console.error("CHECK FRIEND REQUEST ERROR:", {
      code: existingError.code,
      message: existingError.message,
      details: existingError.details,
      hint: existingError.hint,
    });

    return {
      success: false,
      message: "Could not check friend status.",
    };
  }

  if (existing) {
    return {
      success: false,
      message:
        existing.status === "accepted"
          ? "You are already friends."
          : "A friend request already exists.",
    };
  }

  const { error: insertError } = await supabase.from("friends").insert({
    requester_id: user.id,
    addressee_id: addresseeId,
    status: "pending",
  });

  if (insertError) {
    console.error("SEND FRIEND REQUEST ERROR:", {
      code: insertError.code,
      message: insertError.message,
      details: insertError.details,
      hint: insertError.hint,
    });

    return {
      success: false,
      message: "Could not send friend request.",
    };
  }

  revalidatePath("/friends");

  return {
    success: true,
    message: "Friend request sent.",
  };
}