"use server";

import { createClient } from "@/lib/supabase/server";

export async function acknowledgeRankMilestone(rankKey) {
  const cleanRankKey = String(rankKey || "").trim();

  if (!cleanRankKey) {
    return {
      success: false,
      message: "Rank is required.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      message: "You must be logged in to update rank milestones.",
    };
  }

  const { data: rankExists, error: rankError } = await supabase
    .from("user_rank_thresholds")
    .select("key")
    .eq("key", cleanRankKey)
    .eq("is_active", true)
    .maybeSingle();

  if (rankError || !rankExists) {
    return {
      success: false,
      message: "Rank not found.",
    };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      last_seen_rank_key: cleanRankKey,
      last_seen_rank_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    console.error("ACKNOWLEDGE RANK MILESTONE ERROR:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    return {
      success: false,
      message: "Could not update rank milestone.",
    };
  }

  return {
    success: true,
  };
}
