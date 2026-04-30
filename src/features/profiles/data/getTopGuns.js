// src/features/profiles/data/getTopGuns.js

import { createClient } from "@/lib/supabase/server";

export async function getTopGuns(userId) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profile_top_guns")
    .select(
      `
      id,
      name,
      display_order
    `
    )
    .eq("user_id", userId)
    .order("display_order", { ascending: true })
    .limit(4);

  if (error) {
    console.error("GET TOP GUNS ERROR:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    return {
      topGuns: [],
      error,
    };
  }

  return {
    topGuns: data || [],
    error: null,
  };
}