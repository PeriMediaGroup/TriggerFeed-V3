"use client";

import { useState, useTransition } from "react";

import { updateNotificationSettings } from "@/features/notifications/actions/updateNotificationSettings";

const DEFAULT_NOTIFICATION_SETTINGS = {
  mentions_enabled: true,
  comments_enabled: true,
  friend_requests_enabled: true,
  friend_accepts_enabled: true,
};

const NOTIFICATION_OPTIONS = [
  {
    key: "mentions_enabled",
    label: "Mentions",
    description: "Alerts when someone mentions you in a post or comment.",
  },
  {
    key: "comments_enabled",
    label: "Comments",
    description: "Alerts when someone comments on one of your posts.",
  },
  {
    key: "friend_requests_enabled",
    label: "Friend requests",
    description: "Alerts when someone sends you a friend request.",
  },
  {
    key: "friend_accepts_enabled",
    label: "Friend accepts",
    description: "Alerts when someone accepts your friend request.",
  },
];

export default function NotificationSettings({ initialSettings }) {
  const [settings, setSettings] = useState({
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...(initialSettings || {}),
  });

  const [status, setStatus] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleToggle(key) {
    const previousSettings = settings;

    const nextSettings = {
      ...settings,
      [key]: !settings[key],
    };

    setSettings(nextSettings);
    setStatus("Saving...");

    startTransition(async () => {
      try {
        const result = await updateNotificationSettings(nextSettings);

        if (!result?.success) {
          setSettings(previousSettings);
          setStatus(result?.message || "Could not save");
          return;
        }

        setStatus("Saved");
      } catch (error) {
        setSettings(previousSettings);
        setStatus("Could not save");
      }
    });
  }

  return (
    <section className="profile-settings__panel notification-settings">
      <div className="profile-settings__panel-header">
        <div>
          <h3>Notifications</h3>
          <p>Choose which alerts you want to receive.</p>
        </div>

        {status && (
          <p className="profile-settings__status" aria-live="polite">
            {isPending ? "Saving..." : status}
          </p>
        )}
      </div>

      <div className="settings-toggle-list">
        {NOTIFICATION_OPTIONS.map((option) => (
          <SettingsToggle
            key={option.key}
            label={option.label}
            description={option.description}
            checked={settings[option.key]}
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
      <span className="settings-toggle__copy">
        <span className="settings-toggle__label">{label}</span>
        <span className="settings-toggle__description">{description}</span>
      </span>

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
    </label>
  );
}