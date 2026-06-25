export const MODERATION_ROLES = ["moderator", "admin", "ceo"];

export function normalizeRole(role) {
  return typeof role === "string" ? role.trim().toLowerCase() : "";
}

export function getModerationPermissions(role) {
  const cleanRole = normalizeRole(role);

  return {
    role: cleanRole || "user",
    canModerate: MODERATION_ROLES.includes(cleanRole),
    canMute: ["admin", "ceo"].includes(cleanRole),
    canBan: cleanRole === "ceo",
    canManageRoles: cleanRole === "ceo",
    canCreateStickyPost: cleanRole === "ceo",
  };
}
