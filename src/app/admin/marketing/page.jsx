import { redirect } from "next/navigation";

import AdminMarketingPanel from "@/features/admin/components/AdminMarketingPanel";
import { getAdminNavCounts } from "@/features/admin/data/getAdminNavCounts";
import {
  getMarketingAttributionDashboard,
  normalizeMarketingDateRange,
} from "@/features/admin/data/getMarketingAttributionDashboard";
import { getModerationPermissions } from "@/features/admin/permissions";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Marketing Attribution | TriggerFeed Admin",
};

export default async function AdminMarketingPage({ searchParams }) {
  const params = await searchParams;
  const range = normalizeMarketingDateRange(
    typeof params?.range === "string" ? params.range : "all",
  );
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
  const canViewMarketing =
    ["admin", "ceo"].includes(permissions.role) &&
    profile?.is_banned !== true &&
    profile?.is_deleted !== true;

  if (!canViewMarketing) {
    redirect("/");
  }

  const [adminCounts, dashboard] = await Promise.all([
    getAdminNavCounts({
      supabase,
      role: permissions.role,
    }),
    getMarketingAttributionDashboard({ range }),
  ]);

  return (
    <AdminMarketingPanel
      adminCounts={adminCounts}
      dashboard={dashboard}
    />
  );
}
