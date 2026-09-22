import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminPageShell from "@/features/admin/components/AdminPageShell";
import AdminAdsPanel from "@/features/ads/AdminAdsPanel";
export const metadata = { title: "Ads | TriggerFeed Admin" };
export default async function AdminAdsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.rpc("get_my_profile_auth_status").single();
  if (!["admin", "ceo"].includes(profile?.role) || profile?.is_banned || profile?.is_deleted) redirect("/");
  const { data, error } = await supabase.rpc("get_admin_ads_dashboard");
  return <AdminPageShell activeSection="ads" title="Advertising" summary="First-party campaigns and feed performance.">
    {error ? <p role="alert">Could not load ads. Confirm the ads migration is installed and reload.</p> : <AdminAdsPanel dashboard={data} />}
  </AdminPageShell>;
}
