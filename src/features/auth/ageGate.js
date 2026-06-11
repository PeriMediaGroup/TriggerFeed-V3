export const AGE_GATE_VERSION = "v1";
export const MINIMUM_AGE = 18;

export function isValidDobString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;

  const dobDate = new Date(`${value}T00:00:00`);
  return !Number.isNaN(dobDate.getTime());
}

export function isAtLeastMinimumAge(value, asOf = new Date()) {
  if (!isValidDobString(value)) return false;

  const dobDate = new Date(`${value}T00:00:00`);

  let age = asOf.getFullYear() - dobDate.getFullYear();

  const hasHadBirthdayThisYear =
    asOf.getMonth() > dobDate.getMonth() ||
    (asOf.getMonth() === dobDate.getMonth() &&
      asOf.getDate() >= dobDate.getDate());

  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }

  return age >= MINIMUM_AGE;
}
