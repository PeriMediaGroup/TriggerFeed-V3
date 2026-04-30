// src/features/friends/data/getAcceptedFriends.js

import { createClient } from "@/lib/supabase/server";

export async function getAcceptedFriends() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      acceptedFriends: [],
      error: userError || new Error("No authenticated user found."),
    };
  }

  const { data: friendRows, error: friendsError } = await supabase
    .from("friends")
    .select("id, requester_id, addressee_id, status")
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    .eq("status", "accepted");

  if (friendsError) {
    console.error("GET ACCEPTED FRIENDS ERROR:", {
      code: friendsError.code,
      message: friendsError.message,
      details: friendsError.details,
      hint: friendsError.hint,
    });

    return {
      acceptedFriends: [],
      error: friendsError,
    };
  }

  const safeRows = friendRows || [];

  const friendIds = [
    ...new Set(
      safeRows
        .map((row) =>
          row.requester_id === user.id ? row.addressee_id : row.requester_id
        )
        .filter(Boolean)
    ),
  ];

  if (!friendIds.length) {
    return {
      acceptedFriends: [],
      error: null,
    };
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select(
      `
      id,
      username,
      display_name,
      first_name,
      last_name,
      avatar_cloudinary_url
    `
    )
    .in("id", friendIds)
    .eq("is_deleted", false);

  if (profilesError) {
    console.error("GET ACCEPTED FRIEND PROFILES ERROR:", {
      code: profilesError.code,
      message: profilesError.message,
      details: profilesError.details,
      hint: profilesError.hint,
    });

    return {
      acceptedFriends: [],
      error: profilesError,
    };
  }

  const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));

  const acceptedFriends = friendIds
    .map((friendId) => profileMap.get(friendId))
    .filter(Boolean);

  return {
    acceptedFriends,
    error: null,
  };
}