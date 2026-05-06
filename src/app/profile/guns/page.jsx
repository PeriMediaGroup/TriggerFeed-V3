// src/app/profile/guns/page.jsx

import BackLink from "@/components/navigation/BackLink";
import { redirect } from "next/navigation";

import { getCurrentProfile } from "@/features/profiles/data/getCurrentProfile";
import { getTopGuns } from "@/features/profiles/data/getTopGuns";
import EditTopGuns from "@/features/profiles/components/EditTopGuns";

export default async function ProfileGunsPage() {
  const { profile, error } = await getCurrentProfile();

  if (error || !profile) {
    redirect("/login");
  }

  const { topGuns } = await getTopGuns(profile.id);

  return (
    <main className="profile-guns-page">
      <header className="profile-guns-page__header">
        <BackLink
          label="Back to Profile"
          fallbackHref="/profile"
          mode="history"
        />

        <h1>Top Guns</h1>
        <p>Choose up to 4 favorite guns to display on your profile.</p>
      </header>

      <EditTopGuns currentTopGuns={topGuns} />
    </main>
  );
}
