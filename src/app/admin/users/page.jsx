import { redirect } from "next/navigation";

import AdminUsersPanel from "@/features/admin/components/AdminUsersPanel";
import { getAdminNavCounts } from "@/features/admin/data/getAdminNavCounts";
import { getAdminUsers } from "@/features/admin/data/getAdminUsers";
import { getModerationPermissions } from "@/features/admin/permissions";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Users | TriggerFeed Admin",
};

export default async function AdminUsersPage({ searchParams }) {
  const params = await searchParams;
  const query = typeof params?.q === "string" ? params.q : "";

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .rpc("get_my_profile_auth_status")
    .single();

  const permissions = getModerationPermissions(profile?.role);
  const canViewUsers =
    ["admin", "ceo"].includes(permissions.role) &&
    profile?.is_banned !== true &&
    profile?.is_deleted !== true;

  if (!canViewUsers) {
    redirect("/");
  }

  const { users, error } = await getAdminUsers({ query });
  const adminCounts = await getAdminNavCounts({
    supabase,
    role: permissions.role,
  });

  return (
    <AdminUsersPanel
      users={users}
      query={query}
      currentUserId={user.id}
      permissions={permissions}
      error={error}
      adminCounts={adminCounts}
    />
  );
}
