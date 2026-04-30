// src/features/friends/data/getFriendStatus.js

import { createClient } from "@/lib/supabase/server";

export async function getFriendStatus(profileUserId) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      currentUserId: null,
      friendStatus: "logged_out",
      friendship: null,
      error: userError || null,
    };
  }

  if (!profileUserId || profileUserId === user.id) {
    return {
      currentUserId: user.id,
      friendStatus: "self",
      friendship: null,
      error: null,
    };
  }

  const { data: friendship, error } = await supabase
    .from("friends")
    .select("id, requester_id, addressee_id, status, created_at, updated_at")
    .or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${profileUserId}),and(requester_id.eq.${profileUserId},addressee_id.eq.${user.id})`
    )
    .maybeSingle();

  if (error) {
    console.error("GET FRIEND STATUS ERROR:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    return {
      currentUserId: user.id,
      friendStatus: "error",
      friendship: null,
      error,
    };
  }

  if (!friendship) {
    return {
      currentUserId: user.id,
      friendStatus: "none",
      friendship: null,
      error: null,
    };
  }

  if (friendship.status === "accepted") {
    return {
      currentUserId: user.id,
      friendStatus: "friends",
      friendship,
      error: null,
    };
  }

  if (friendship.status === "pending") {
    const isIncoming = friendship.addressee_id === user.id;

    return {
      currentUserId: user.id,
      friendStatus: isIncoming ? "incoming_pending" : "outgoing_pending",
      friendship,
      error: null,
    };
  }

  return {
    currentUserId: user.id,
    friendStatus: friendship.status || "unknown",
    friendship,
    error: null,
  };
}