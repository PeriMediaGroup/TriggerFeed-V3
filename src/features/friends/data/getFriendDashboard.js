// src/features/friends/data/getFriendDashboard.js

import { createClient } from "@/lib/supabase/server";

export async function getFriendDashboard() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      user: null,
      incomingRequests: [],
      outgoingRequests: [],
      friends: [],
      error: userError || new Error("No authenticated user found."),
    };
  }

  const { data: friendRows, error: friendsError } = await supabase
    .from("friends")
    .select("id, requester_id, addressee_id, status, created_at, updated_at")
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  if (friendsError) {
    console.error("GET FRIEND DASHBOARD ERROR:", {
      code: friendsError.code,
      message: friendsError.message,
      details: friendsError.details,
      hint: friendsError.hint,
    });

    return {
      user,
      incomingRequests: [],
      outgoingRequests: [],
      friends: [],
      error: friendsError,
    };
  }

  const safeRows = friendRows || [];

  const otherUserIds = [
    ...new Set(
      safeRows
        .map((row) =>
          row.requester_id === user.id ? row.addressee_id : row.requester_id
        )
        .filter(Boolean)
    ),
  ];

  let profiles = [];

  if (otherUserIds.length) {
    const { data: profileRows, error: profilesError } = await supabase.rpc(
      "get_public_profile_cards",
      {
        p_profile_ids: otherUserIds,
      }
    );

    if (profilesError) {
      console.error("GET FRIEND PROFILES ERROR:", {
        code: profilesError.code,
        message: profilesError.message,
        details: profilesError.details,
        hint: profilesError.hint,
      });
    } else {
      profiles = profileRows || [];
    }
  }

  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));

  const rowsWithProfiles = safeRows.map((row) => {
    const otherUserId =
      row.requester_id === user.id ? row.addressee_id : row.requester_id;

    return {
      ...row,
      otherUser: profileMap.get(otherUserId) || null,
      isIncoming: row.addressee_id === user.id,
      isOutgoing: row.requester_id === user.id,
    };
  });

  return {
    user,
    incomingRequests: rowsWithProfiles.filter(
      (row) => row.status === "pending" && row.isIncoming
    ),
    outgoingRequests: rowsWithProfiles.filter(
      (row) => row.status === "pending" && row.isOutgoing
    ),
    friends: rowsWithProfiles.filter((row) => row.status === "accepted"),
    error: null,
  };
}