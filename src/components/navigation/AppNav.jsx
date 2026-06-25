import { createClient } from "@/lib/supabase/server";
import { getAdminNavCounts } from "@/features/admin/data/getAdminNavCounts";
import { MODERATION_ROLES, normalizeRole } from "@/features/admin/permissions";
import AppNavMenu from "@/components/navigation/AppNavMenu";

export default async function AppNav() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return (
      <AppNavMenu
        isLoggedIn={false}
        displayName={null}
        role={null}
        unreadNotifications={0}
        adminCounts={null}
      />
    );
  }

  const [
    { data: profile, error: profileError },
    { data: authStatus, error: authStatusError },
  ] = await Promise.all([
    supabase.rpc("get_my_profile").maybeSingle(),
    supabase.rpc("get_my_profile_auth_status").maybeSingle(),
  ]);

  if (profileError) {
    console.error("APP NAV PROFILE ERROR:", {
      code: profileError.code,
      message: profileError.message,
      details: profileError.details,
      hint: profileError.hint,
    });
  }

  if (authStatusError) {
    console.error("APP NAV AUTH STATUS ERROR:", {
      code: authStatusError.code,
      message: authStatusError.message,
      details: authStatusError.details,
      hint: authStatusError.hint,
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
  const cleanRole = normalizeRole(authStatus?.role);
  const adminCounts = MODERATION_ROLES.includes(cleanRole)
    ? await getAdminNavCounts({ supabase, role: cleanRole })
    : null;

  return (
    <AppNavMenu
      isLoggedIn
      displayName={displayName}
      role={authStatus?.role}
      unreadNotifications={unreadNotifications ?? 0}
      adminCounts={adminCounts}
    />
  );
}
