export const DEFAULT_PROFILE_PRIVACY_SETTINGS = Object.freeze({
  profile_visibility: Object.freeze({
    show_city: true,
    show_state: true,
    show_email: false,
  }),
});

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readBoolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizeProfilePrivacySettings(settings) {
  const safeSettings = isPlainObject(settings) ? settings : {};
  const profileVisibility = isPlainObject(safeSettings.profile_visibility)
    ? safeSettings.profile_visibility
    : {};

  return {
    profile_visibility: {
      show_city: readBoolean(
        profileVisibility.show_city,
        DEFAULT_PROFILE_PRIVACY_SETTINGS.profile_visibility.show_city,
      ),
      show_state: readBoolean(
        profileVisibility.show_state,
        DEFAULT_PROFILE_PRIVACY_SETTINGS.profile_visibility.show_state,
      ),
      show_email: readBoolean(
        profileVisibility.show_email,
        DEFAULT_PROFILE_PRIVACY_SETTINGS.profile_visibility.show_email,
      ),
    },
  };
}

export function getProfileVisibility(settings) {
  return normalizeProfilePrivacySettings(settings).profile_visibility;
}
