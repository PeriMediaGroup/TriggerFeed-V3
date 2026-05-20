import { createClient } from "@/lib/supabase/server";

export async function getCurrentProfile() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      profile: null,
      error: userError || new Error("No authenticated user found."),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      `
      id,
      username,
      first_name,
      last_name,
      display_name,
      avatar_cloudinary_url,
      banner_cloudinary_url,
      role,
      profile_badge,
      city,
      state,
      bio,
      created_at,
      updated_at
    `
    )
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("GET CURRENT PROFILE ERROR:", profileError);

    return {
      profile: null,
      error: profileError,
    };
  }

  return {
    profile,
    error: null,
  };
}