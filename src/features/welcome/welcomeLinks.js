// Preserve the existing acquisition/referral contract, including internal-ad
// markers used by AttributionTracker. No second attribution store.
const JOURNEY_PARAMS = [
  "source",
  "campaign",
  "ref",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
];

export function getWelcomeLinks(searchParams = {}) {
  const query = new URLSearchParams();
  for (const key of JOURNEY_PARAMS) {
    const raw = typeof searchParams?.get === "function"
      ? searchParams.get(key)
      : searchParams?.[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value === "string" && value) query.set(key, value);
  }
  const suffix = query.size ? `?${query}` : "";
  return {
    member: `/signup${suffix}`,
    creator: `/signup/creator${suffix}`,
    organization: `/signup/organization${suffix}`,
    login: `/login${suffix}`,
  };
}
