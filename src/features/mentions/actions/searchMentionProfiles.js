"use server";

import { createClient } from "@/lib/supabase/server";

function logSupabaseError(label, error) {
  console.error(label, {
    raw: error,
    name: error?.name,
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
    status: error?.status,
  });
}

export async function searchMentionProfiles(query) {
  const cleanQuery = String(query || "")
    .trim()
    .toLowerCase();

  if (!cleanQuery) {
    return {
      success: true,
      profiles: [],
      error: null,
    };
  }

  const supabase = await createClient();

  const { data: profileMatches, error } = await supabase
    .from("profiles")
    .select("id, username")
    .ilike("username_lower", `${cleanQuery}%`)
    .not("username", "is", null)
    .order("username_lower", { ascending: true })
    .limit(8);

  if (error) {
    logSupabaseError("SEARCH MENTION PROFILES ERROR:", error);

    return {
      success: false,
      profiles: [],
      error: "Could not search profiles.",
    };
  }

  const profileIds = (profileMatches || []).map((profile) => profile.id);

  if (!profileIds.length) {
    return {
      success: true,
      profiles: [],
      error: null,
    };
  }

  const { data: profiles, error: profilesError } = await supabase.rpc(
    "get_public_profile_cards",
    {
      p_profile_ids: profileIds,
    }
  );

  if (profilesError) {
    logSupabaseError("SEARCH MENTION PROFILE CARDS ERROR:", profilesError);

    return {
      success: false,
      profiles: [],
      error: "Could not search profiles.",
    };
  }

  const profileMap = new Map(
    (profiles || []).map((profile) => [profile.id, profile])
  );

  return {
    success: true,
    profiles: profileIds
      .map((profileId) => profileMap.get(profileId))
      .filter(Boolean),
    error: null,
  };
}
