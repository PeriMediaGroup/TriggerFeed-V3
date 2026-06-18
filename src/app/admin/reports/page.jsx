import { redirect } from "next/navigation";

import ReportPanel from "@/features/reports/components/ReportPanel";
import { getModerationPermissions } from "@/features/admin/permissions";
import { getAbuseReports } from "@/features/reports/data/getAbuseReports";
import { getPostReports } from "@/features/reports/data/getPostReports";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Reports | TriggerFeed Admin",
};

export default async function AdminReportsPage() {

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
  const canViewReports =
    permissions.canModerate &&
    profile?.is_banned !== true &&
    profile?.is_deleted !== true;

  if (!canViewReports) {
    console.error("ADMIN REPORTS REDIRECT: not moderator", {
      userId: user.id,
      profile,
      role: permissions.role,
    });

    redirect("/");
  }

  const reports = await getPostReports();
  const abuseReports = ["admin", "ceo"].includes(permissions.role)
    ? await getAbuseReports()
    : [];

  return (
    <ReportPanel
      reports={reports}
      abuseReports={abuseReports}
      permissions={permissions}
    />
  );
}
