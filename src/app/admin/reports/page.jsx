import { redirect } from "next/navigation";

import ReportPanel from "@/features/reports/components/ReportPanel";
import { getPostReports } from "@/features/reports/data/getPostReports";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Post Reports | TriggerFeed Admin",
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
    .from("profiles")
    .select("id, username, role, is_banned, is_deleted")
    .eq("id", user.id)
    .single();

  const cleanRole =
    typeof profile?.role === "string" ? profile.role.trim().toLowerCase() : "";

  const isAdmin =
    ["admin", "ceo"].includes(cleanRole) &&
    profile?.is_banned !== true &&
    profile?.is_deleted !== true;

  if (!isAdmin) {
    console.error("ADMIN REPORTS REDIRECT: not admin", {
      userId: user.id,
      profile,
      cleanRole,
    });

    redirect("/");
  }

  const reports = await getPostReports();

  return <ReportPanel reports={reports} />;
}