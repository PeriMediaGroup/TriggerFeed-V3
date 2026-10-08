import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminPageShell from "@/features/admin/components/AdminPageShell";
import RemoveFoundingButton from "@/features/admin/components/RemoveFoundingButton";
import FoundingMaintenance from "@/features/admin/components/FoundingMaintenance";

export const metadata = { title: "Founding 500 | TriggerFeed Admin" };

export default async function AdminFoundingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.rpc("get_my_profile_auth_status").single();
  if (!["admin", "ceo"].includes(profile?.role) || profile.is_banned || profile.is_deleted) redirect("/");
  const { data, error } = await supabase.rpc("get_admin_founding_500");
  const finalized = Boolean(data?.finalized_at);
  return <AdminPageShell activeSection="founding" title="Founding 500" summary="Manage Founding membership and enrollment.">
    {error || !data ? <p role="alert">Could not load Founding management. Refresh to try again.</p> : <>
      <p><strong>{finalized ? "Finalized" : "Open enrollment"}</strong> · Assigned: {data.assigned} / 500 · Remaining: {data.remaining}{finalized ? " (enrollment closed)" : ""}</p>
      <p>{finalized ? "Numbers are permanent. Removed members retire their numbers; retired numbers remain reserved." : "Founding positions are provisional and may be administratively reclaimed or resequenced."}</p>
      {!finalized && data.needs_repair ? <p role="alert">Registry review/CEO repair is required before normal removal or finalization.</p> : null}
      {profile.role === "ceo" ? <FoundingMaintenance finalized={finalized} /> : null}
      <div className="admin-users__list">
        {data.entries.map((entry) => <article className="admin-user-card" key={entry.number}>
          <h2>#{entry.number} · {entry.display_name || entry.username || "Retired position"}</h2>
          <p>{entry.username ? `@${entry.username} · ` : ""}{entry.profile_type || "—"} · {entry.active ? entry.is_banned ? "Banned" : "Active" : entry.released ? "Released" : "Retired"}</p>
          <p>Assigned {new Date(entry.assigned_at).toLocaleDateString("en-US")}{entry.created_at ? ` · Joined ${new Date(entry.created_at).toLocaleDateString("en-US")}` : ""}</p>
          <div className="admin-user-card__actions">
            {entry.profile_id ? <Link className="admin-user-card__action" href={`/profiles/${entry.profile_id}`}>View Profile</Link> : null}
            {entry.active ? <RemoveFoundingButton userId={entry.profile_id} number={entry.number} name={entry.display_name || entry.username || "this member"} finalized={finalized} /> : null}
          </div>
        </article>)}
      </div>
    </>}
  </AdminPageShell>;
}
