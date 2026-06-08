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

  const [{ data: profile, error: profileError }, { data: authStatus, error: authStatusError }] =
    await Promise.all([
      supabase
        .rpc("get_my_profile")
        .single(),

      supabase.rpc("get_my_profile_auth_status").single(),
    ]);

  if (profileError) {
    console.error("GET CURRENT PROFILE ERROR:", {
      code: profileError?.code,
      message: profileError?.message,
      details: profileError?.details,
      hint: profileError?.hint,
    });

    return {
      profile: null,
      error: profileError,
    };
  }

  if (authStatusError) {
    console.warn("GET CURRENT PROFILE AUTH STATUS ERROR:", {
      name: authStatusError?.name,
      code: authStatusError?.code,
      message: authStatusError?.message,
      status: authStatusError?.status,
    });

    return {
      profile: null,
      error: authStatusError,
    };
  }

  return {
    profile: {
      ...profile,
      role: authStatus?.role || "user",
      is_banned: authStatus?.is_banned || false,
      is_muted: authStatus?.is_muted || false,
      is_deleted: authStatus?.is_deleted || false,
    },
    error: null,
  };
}
