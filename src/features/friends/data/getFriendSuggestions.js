import { createClient } from "@/lib/supabase/server";

function normalizeSuggestion(suggestion) {
  return {
    id: suggestion.id,
    username: suggestion.username || "",
    displayName: suggestion.display_name || suggestion.username || "TriggerFeed user",
    avatarUrl: suggestion.avatar_cloudinary_url || "",
    // Keep both names during the branch merge so existing consumers from either
    // branch continue to work. We can normalize to one name in a later cleanup.
    founding_member_number: suggestion.founding_member_number || null,
    foundingMemberNumber: suggestion.founding_member_number || null,
    reason: suggestion.suggestion_reason || "Active recently",
    mutualFriendCount: suggestion.mutual_friend_count ?? 0,
    rankScore: suggestion.rank_score ?? 0,
  };
}

export async function getFriendSuggestions({ limit = 4, viewerId = null } = {}) {
  if (!viewerId) {
    return {
      suggestions: [],
      error: null,
      didFetch: false,
    };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_friend_suggestions", {
    p_limit: limit,
  });

  if (error) {
    console.error("GET FRIEND SUGGESTIONS ERROR:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    return {
      suggestions: [],
      error,
      didFetch: true,
    };
  }

  return {
    suggestions: (data || []).map(normalizeSuggestion),
    error: null,
    didFetch: true,
  };
}
