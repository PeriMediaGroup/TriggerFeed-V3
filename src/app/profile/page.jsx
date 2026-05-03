// src/app/profile/page.jsx

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
  const { profile, error } = await getCurrentProfile();

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
      />

      <ProfileShowcase
        topFriends={topFriends}
        topGuns={topGuns}
      />

      <ProfileLatestPost latestPost={latestPost} />

    </main>
  );
}