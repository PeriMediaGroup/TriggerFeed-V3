import { redirect } from "next/navigation";

import { getModerationPermissions } from "@/features/admin/permissions";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Management | TriggerFeed Admin",
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
  const canViewManagement =
    permissions.canModerate &&
    profile?.is_banned !== true &&
    profile?.is_deleted !== true;

  if (!canViewManagement) {
    redirect("/");
  }

  redirect("/admin/reports");
}
