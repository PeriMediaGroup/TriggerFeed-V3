export const ATTRIBUTION_STORAGE_KEY = "triggerfeed.marketingAttribution";
export const ATTRIBUTION_VISITOR_KEY = "triggerfeed.marketingVisitorId";

const TOKEN_MAX_LENGTH = 80;
const ATTRIBUTION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 90;

export function normalizeAttributionToken(value) {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (
    !normalized ||
    normalized.length > TOKEN_MAX_LENGTH ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)
  ) {
    return "";
  }

  return normalized;
}

export function parseAttributionParams(searchParams) {
  const source = normalizeAttributionToken(searchParams?.get("source"));
  const campaign = normalizeAttributionToken(searchParams?.get("campaign"));

  if (!source && !campaign) {
    return null;
  }

  return {
    source,
    campaign,
  };
}

export function getDeviceCategory(userAgent = "") {
  const agent = userAgent.toLowerCase();

  if (!agent) {
    return "unknown";
  }

  if (/ipad|tablet|kindle|silk|playbook/.test(agent)) {
    return "tablet";
  }

  if (/mobi|android|iphone|ipod|windows phone/.test(agent)) {
    return "mobile";
  }

  return "desktop";
}

export function getOrCreateVisitorId() {
  try {
    const stored = window.localStorage.getItem(ATTRIBUTION_VISITOR_KEY);

    if (stored && /^[0-9a-f-]{36}$/i.test(stored)) {
      return stored;
    }

    const visitorId = crypto.randomUUID();
    window.localStorage.setItem(ATTRIBUTION_VISITOR_KEY, visitorId);
    return visitorId;
  } catch {
    return crypto.randomUUID();
  }
}

export function readStoredAttribution() {
  try {
    const raw = window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const attribution = JSON.parse(raw);

    if (
      !attribution?.visitorId ||
      Date.now() - Number(attribution.firstSeenAt || 0) > ATTRIBUTION_MAX_AGE_MS
    ) {
      window.localStorage.removeItem(ATTRIBUTION_STORAGE_KEY);
      return null;
    }

    return attribution;
  } catch {
    return null;
  }
}

export function storeFirstTouchAttribution(attribution) {
  if (!attribution?.visitorId || !attribution?.source) {
    return null;
  }

  const existing = readStoredAttribution();

  if (existing?.source) {
    return existing;
  }

  const stored = {
    visitorId: attribution.visitorId,
    source: attribution.source,
    campaign: attribution.campaign || "",
    landingPath: attribution.landingPath || "",
    firstSeenAt: attribution.firstSeenAt || Date.now(),
  };

  try {
    window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // The visit is still recorded server-side when possible.
  }

  return stored;
}

export function clearStoredAttribution() {
  try {
    window.localStorage.removeItem(ATTRIBUTION_STORAGE_KEY);
  } catch {
    // Nothing else to clear.
  }
}
