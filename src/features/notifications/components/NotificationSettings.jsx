"use client";

import { useState, useTransition } from "react";

import { updateNotificationSettings } from "@/features/notifications/actions/updateNotificationSettings";

const DEFAULT_NOTIFICATION_SETTINGS = {
  mentions_enabled: true,
  comments_enabled: true,
  friend_requests_enabled: true,
  friend_accepts_enabled: true,
  email_enabled: true,
  email_comments: true,
  email_mentions: true,
  email_friend_requests: true,
  email_friend_accepted: true,
  email_announcements: true,
  email_marketing: false,
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

const EMAIL_CORE_OPTIONS = [
  {
    key: "email_comments",
    label: "Comments on my posts",
    description: "Email me when someone comments on one of my posts.",
  },
  {
    key: "email_mentions",
    label: "Mentions",
    description: "Email me when someone mentions me in a post or comment.",
  },
  {
    key: "email_friend_requests",
    label: "Friend requests",
    description: "Email me when someone sends me a friend request.",
  },
  {
    key: "email_friend_accepted",
    label: "Friend request accepted",
    description: "Email me when someone accepts my friend request.",
  },
];

const EMAIL_UPDATE_OPTIONS = [
  {
    key: "email_announcements",
    label: "TriggerFeed announcements & updates",
    description: "Product news, feature updates, and service announcements.",
  },
  {
    key: "email_marketing",
    label: "Promotions & newsletters",
    description: "Occasional promotional email and newsletter updates.",
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
          setStatus(result?.message || "Could not save settings.");
          return;
        }

        setStatus("Settings saved.");
      } catch (error) {
        setSettings(previousSettings);
        setStatus("Could not save settings.");
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

      <div className="notification-settings__section">
        <div className="notification-settings__section-header">
          <h4>Email Preferences</h4>
          <p>Choose which optional emails you want to receive.</p>
        </div>

        <div className="settings-toggle-list">
          <SettingsToggle
            label="Email notifications"
            description="Master control for optional TriggerFeed emails."
            checked={settings.email_enabled}
            disabled={isPending}
            onChange={() => handleToggle("email_enabled")}
          />

          {EMAIL_CORE_OPTIONS.map((option) => (
            <SettingsToggle
              key={option.key}
              label={option.label}
              description={option.description}
              checked={settings[option.key]}
              disabled={isPending || !settings.email_enabled}
              onChange={() => handleToggle(option.key)}
            />
          ))}

          {EMAIL_UPDATE_OPTIONS.map((option) => (
            <SettingsToggle
              key={option.key}
              label={option.label}
              description={option.description}
              checked={settings[option.key]}
              disabled={isPending || !settings.email_enabled}
              onChange={() => handleToggle(option.key)}
            />
          ))}
        </div>

        <div className="notification-settings__required-email">
          <span>Account, security, and moderation emails</span>
          <strong>Always enabled</strong>
        </div>
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
