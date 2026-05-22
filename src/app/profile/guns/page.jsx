// src/app/profile/guns/page.jsx

import { redirect } from "next/navigation";

import { getCurrentProfile } from "@/features/profiles/data/getCurrentProfile";
import { getTopGuns } from "@/features/profiles/data/getTopGuns";
import ManageGunsPanel from "@/features/guns/components/ManageGunsPanel";

export default async function ProfileGunsPage() {
  const { profile, error } = await getCurrentProfile();

  if (error || !profile) {
    redirect("/login");
  }

  const { topGuns } = await getTopGuns(profile.id);

  return (
    <main className="profile-guns-page">
      <ManageGunsPanel topGuns={topGuns} />
    </main>
  );
}
