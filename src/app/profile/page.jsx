// src/app/profile/page.jsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

import { getCurrentProfile } from "@/features/profiles/data/getCurrentProfile";
import { getProfileStats } from "@/features/profiles/data/getProfileStats";
import { getLatestPost } from "@/features/profiles/data/getLatestPost";
import { getTopFriends } from "@/features/profiles/data/getTopFriends";
import { getTopGuns } from "@/features/profiles/data/getTopGuns";

import ProfileHeader from "@/features/profiles/components/ProfileHeader";
import ProfileShowcase from "@/features/profiles/components/ProfileShowcase";
import ProfileLatestPost from "@/features/profiles/components/ProfileLatestPost";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { profile, error } = await getCurrentProfile();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return (
      <main className="profile-page">
        <h1>Profile</h1>
        <p>You must be logged in to view your profile.</p>
      </main>
    );
  }

  const { count: unreadNotifications } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false)
    .is("dismissed_at", null);

  if (error || !profile) {
    redirect("/login");
  }

  const [{ stats }, { latestPost }, { topFriends }, { topGuns }] =
    await Promise.all([
      getProfileStats(profile.id),
      getLatestPost(profile.id),
      getTopFriends(profile.id),
      getTopGuns(profile.id),
    ]);

  return (
    <main className="profile">
      <ProfileHeader
        profile={profile}
        stats={stats}
        isCurrentUser
        unreadNotifications={unreadNotifications ?? 0}
      />

      <ProfileShowcase topFriends={topFriends} topGuns={topGuns} />

      <ProfileLatestPost latestPost={latestPost} />
    </main>
  );
}
