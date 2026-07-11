import { redirect } from "next/navigation";

import AdminOverviewPanel from "@/features/admin/components/AdminOverviewPanel";
import { getAdminActivityOverview } from "@/features/admin/data/getAdminActivityOverview";
import { getAdminNavCounts } from "@/features/admin/data/getAdminNavCounts";
import { getModerationPermissions } from "@/features/admin/permissions";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Control Panel | TriggerFeed Admin",
};

export default async function AdminPage() {
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
  const canViewOverview =
    ["admin", "ceo"].includes(permissions.role) &&
    profile?.is_banned !== true &&
    profile?.is_deleted !== true;

  if (!canViewOverview) {
    redirect("/");
  }

  const [adminCounts, activityResult] = await Promise.all([
    getAdminNavCounts({
      supabase,
      role: permissions.role,
    }),
    getAdminActivityOverview({
      supabase,
      recentLimit: 10,
    }),
  ]);

  return (
    <AdminOverviewPanel
      adminCounts={adminCounts}
      overview={activityResult.overview}
      overviewError={activityResult.error}
    />
  );
}
