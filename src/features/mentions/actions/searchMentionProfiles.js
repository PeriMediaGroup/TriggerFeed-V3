"use server";

import { createClient } from "@/lib/supabase/server";

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

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, first_name, avatar_cloudinary_url")
    .ilike("username_lower", `${cleanQuery}%`)
    .not("username", "is", null)
    .order("username_lower", { ascending: true })
    .limit(8);

  if (error) {
    console.error("SEARCH MENTION PROFILES ERROR:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    return {
      success: false,
      profiles: [],
      error: "Could not search profiles.",
    };
  }

  return {
    success: true,
    profiles: data || [],
    error: null,
  };
}