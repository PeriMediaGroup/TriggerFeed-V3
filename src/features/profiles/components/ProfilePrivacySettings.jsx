"use client";

import { useActionState } from "react";

import { updateProfilePrivacySettings } from "@/features/profiles/actions/updateProfilePrivacySettings";
import { getProfileVisibility } from "@/features/profiles/lib/privacySettings";

const initialState = {
  success: false,
  message: "",
};

export default function ProfilePrivacySettings({ profile }) {
  const [state, formAction, isPending] = useActionState(
    updateProfilePrivacySettings,
    initialState,
  );

  const visibility = getProfileVisibility(profile?.privacy_settings);

  return (
    <section className="profile-privacy-settings">
      <header className="profile-privacy-settings__header">
        <h2>Profile Settings</h2>
        <p>Control which profile fields appear on your public profile.</p>
      </header>

      {state?.message && (
        <p
          className={
            state.success
              ? "profile-privacy-settings__message"
              : "profile-privacy-settings__error"
          }
        >
          {state.message}
        </p>
      )}

      <form action={formAction} className="profile-privacy-settings__form">
        <label className="profile-privacy-settings__option">
          <input
            type="checkbox"
            name="show_city"
            defaultChecked={visibility.show_city}
          />
          <span>Show city on my public profile</span>
        </label>

        <label className="profile-privacy-settings__option">
          <input
            type="checkbox"
            name="show_state"
            defaultChecked={visibility.show_state}
          />
          <span>Show state on my public profile</span>
        </label>

        <label className="profile-privacy-settings__option">
          <input
            type="checkbox"
            name="show_email"
            defaultChecked={visibility.show_email}
          />
          <span>Show email on my public profile</span>
        </label>

        <div className="profile-privacy-settings__actions">
          <button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </form>
    </section>
  );
}
