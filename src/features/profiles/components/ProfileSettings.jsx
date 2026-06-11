import ProfilePrivacySettings from "./ProfilePrivacySettings";
import DeleteAccountDangerZone from "./DeleteAccountDangerZone";
import NotificationSettings from "@/features/notifications/components/NotificationSettings";

export default function ProfileSettings({ profile, notificationSettings }) {
  return (
    <section className="profile-settings">
      <header className="profile-settings__header">
        <h2>Settings</h2>
        <p>Manage privacy and notification preferences.</p>
      </header>

      <div className="profile-settings__sections">
        <ProfilePrivacySettings profile={profile} />

        <NotificationSettings initialSettings={notificationSettings} />

        <DeleteAccountDangerZone />
      </div>
    </section>
  );
}
