"use client";

import { useState, useTransition } from "react";

import { updateProfilePrivacySettings } from "@/features/profiles/actions/updateProfilePrivacySettings";
import { getProfileVisibility } from "@/features/profiles/lib/privacySettings";

const PRIVACY_OPTIONS = [
  {
    key: "show_real_name",
    label: "Real Name",
    description: "Show your first and last name on your public profile.",
  },
  {
    key: "show_city",
    label: "City",
    description: "Show your city on your public profile.",
  },
  {
    key: "show_state",
    label: "State",
    description: "Show your state on your public profile.",
  },
  {
    key: "show_email",
    label: "Email",
    description: "Show your email address on your public profile.",
  },
  {
    key: "show_birthday",
    label: "Show my birthday on my public profile",
    description: "Shows only month and day. Your birth year and age stay private.",
  },
];

function formatLockedDob(dob) {
  if (!dob) {
    return "";
  }

  const dateParts = String(dob).slice(0, 10).split("-");

  if (dateParts.length !== 3) {
    return "";
  }

  const [year, month, day] = dateParts.map((part) => Number.parseInt(part, 10));

  if (!year || !month || !day) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export default function ProfilePrivacySettings({ profile }) {
  const initialVisibility = getProfileVisibility(profile?.privacy_settings);
  const lockedDob = formatLockedDob(profile?.dob);

  const [visibility, setVisibility] = useState(initialVisibility);
  const [status, setStatus] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleToggle(key) {
    const previousVisibility = visibility;

    const nextVisibility = {
      ...visibility,
      [key]: !visibility[key],
    };

    setVisibility(nextVisibility);
    setStatus("Saving...");

    startTransition(async () => {
      try {
        const result = await updateProfilePrivacySettings(nextVisibility);

        if (!result?.success) {
          setVisibility(previousVisibility);
          setStatus(result?.message || "Could not save settings.");
          return;
        }

        setStatus("Settings saved.");
      } catch (error) {
        setVisibility(previousVisibility);
        setStatus("Could not save settings.");
      }
    });
  }

  return (
    <section className="profile-settings__panel profile-privacy-settings">
      <div className="profile-settings__panel-header">
        <div>
          <h3>Profile Privacy</h3>
          <p>Choose what appears on your public profile.</p>
        </div>

        {status && (
          <p className="profile-settings__status" aria-live="polite">
            {isPending ? "Saving..." : status}
          </p>
        )}
      </div>

      <div className="profile-privacy-settings__locked-field">
        <span className="profile-privacy-settings__locked-label">Birthday</span>
        <span className="profile-privacy-settings__locked-value">
          {lockedDob || "Birthday has not been set."}
        </span>
        <span className="profile-privacy-settings__locked-help">
          Birthday is locked after signup.
        </span>
      </div>

      <div className="settings-toggle-list">
        {PRIVACY_OPTIONS.map((option) => (
          <SettingsToggle
            key={option.key}
            label={option.label}
            description={option.description}
            checked={visibility[option.key]}
            disabled={isPending}
            onChange={() => handleToggle(option.key)}
          />
        ))}
      </div>
    </section>
  );
}

function SettingsToggle({ label, description, checked, disabled, onChange }) {
  return (
    <label className="settings-toggle">

      <span className="settings-toggle__switch">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={onChange}
          className="settings-toggle__input"
        />
        <span className="settings-toggle__slider" />
      </span>
      <span className="settings-toggle__copy">
        <span className="settings-toggle__label">{label}</span>
        <span className="settings-toggle__description">{description}</span>
      </span>
    </label>
  );
}
