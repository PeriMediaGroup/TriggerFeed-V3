export const EDITABLE_PROFILE_TYPES = ["member", "creator", "organization"];

export function canChangeProfileType(user) {
  return user.account_type === "user"
    && EDITABLE_PROFILE_TYPES.includes(user.profile_type)
    && !user.is_deleted;
}

export function foundingReleaseWarning(user, nextType) {
  const number = user.founding_member_number;
  if (nextType !== "organization"
    || !["member", "creator"].includes(user.profile_type)
    || !Number.isInteger(number) || number < 1 || number > 500) return "";
  return `Changing this profile to Organization will release Founding Member #${number}. The number will become available to another eligible member or creator.`;
}
