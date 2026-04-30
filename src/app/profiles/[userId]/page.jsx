import { notFound } from "next/navigation";
import "@/features/profiles/styles/profile.scss";

import { getProfileById } from "@/features/profiles/data/getProfileById";
import { getProfileStats } from "@/features/profiles/data/getProfileStats";
import { getLatestPost } from "@/features/profiles/data/getLatestPost";
import { getTopFriends } from "@/features/profiles/data/getTopFriends";
import { getTopGuns } from "@/features/profiles/data/getTopGuns";

import ProfileHeader from "@/features/profiles/components/ProfileHeader";
import ProfileShowcase from "@/features/profiles/components/ProfileShowcase";
import ProfileLatestPost from "@/features/profiles/components/ProfileLatestPost";

export default async function PublicProfilePage({ params }) {
  const { userId } = await params;

  const { profile, error } = await getProfileById(userId);

  if (error || !profile) {
    notFound();
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
        isCurrentUser={false}
      />

      <ProfileShowcase
        topFriends={topFriends}
        topGuns={topGuns}
      />

      <ProfileLatestPost latestPost={latestPost} />
    </main>
  );
}