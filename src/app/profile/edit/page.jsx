// src/app/profile/edit/page.jsx

import { redirect } from "next/navigation";
import BackLink from "@/components/navigation/BackLink";

import { getCurrentProfile } from "@/features/profiles/data/getCurrentProfile";
import EditProfileForm from "@/features/profiles/components/EditProfileForm";

export default async function EditProfilePage({ searchParams }) {
  const { profile, error } = await getCurrentProfile();

  if (error || !profile) {
    redirect("/login");
  }

  const resolvedSearchParams = await searchParams;
  const setupRequired = resolvedSearchParams?.setup === "required";

  return (
    <main className="profile-edit">
      <div className="profile-edit__header">
        <BackLink
          label="Back to Profile"
          fallbackHref="/profile"
          mode="history"
        />

        <h1>Edit Profile</h1>

        {setupRequired && (
          <p className="profile-edit__notice">
            Please set up your profile before you post.
          </p>
        )}
      </div>

      <EditProfileForm profile={profile} />
    </main>
  );
}
