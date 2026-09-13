import { createClient } from "@/lib/supabase/server";

export async function getFounding500Registry() {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_founding_500_registry");

  if (error) {
    console.error("GET FOUNDING 500 REGISTRY ERROR:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    return {
      entries: [],
      error,
    };
  }

  return {
    entries: data || [],
    error: null,
  };
}
