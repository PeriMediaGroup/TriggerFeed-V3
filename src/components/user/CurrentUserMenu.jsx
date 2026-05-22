import { createClient } from "@/lib/supabase/server";
import CurrentUserDropdown from "@/components/user/CurrentUserDropdown";

export default async function CurrentUserMenu() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return (
      <CurrentUserDropdown
        isLoggedIn={false}
        displayName={null}
        role={null}
        unreadNotifications={0}
      />
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("username, first_name, last_name, display_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("CURRENT USER PROFILE ERROR:", {
      code: profileError.code,
      message: profileError.message,
      details: profileError.details,
      hint: profileError.hint,
    });
  }

  const { count: unreadNotifications } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false)
    .is("dismissed_at", null);

  const displayName = profile?.username
    ? `@${profile.username}`
    : profile?.first_name
      ? profile.first_name
      : user.email || "Account";

  return (
    <CurrentUserDropdown
      isLoggedIn
      displayName={displayName}
      role={profile?.role}
      unreadNotifications={unreadNotifications ?? 0}
    />
  );
}
