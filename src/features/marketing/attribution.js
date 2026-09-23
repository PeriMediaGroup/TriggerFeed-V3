export const ATTRIBUTION_STORAGE_KEY = "triggerfeed.marketingAttribution";
export const ATTRIBUTION_VISITOR_KEY = "triggerfeed.marketingVisitorId";

const TOKEN_MAX_LENGTH = 80;
const ATTRIBUTION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 90;

function createRandomVisitorId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  const randomValues = new Uint8Array(16);
  globalThis.crypto?.getRandomValues?.(randomValues);

  if (randomValues.some(Boolean)) {
    randomValues[6] = (randomValues[6] & 0x0f) | 0x40;
    randomValues[8] = (randomValues[8] & 0x3f) | 0x80;

    return [...randomValues]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("")
      .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
  }

  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (value) =>
    (
      Number(value) ^
      (Math.random() * 16) >> (Number(value) / 4)
    ).toString(16),
  );
}

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
  if (isInternalAdAttribution(searchParams)) {
    return null;
  }

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

// These are explicit markers emitted by ads/adHelpers.adDestination.
// Campaign IDs are opaque: UUIDs are valid external campaign names too.
export function isInternalAdAttribution(searchParams) {
  return (
    normalizeAttributionToken(searchParams?.get("source")) === "triggerfeed" ||
    searchParams?.get("utm_medium")?.trim().toLowerCase() === "in-feed-ad"
  );
}

function isStoredInternalAd(attribution) {
  const params = new URLSearchParams();
  params.set("source", attribution?.source || "");
  if (isInternalAdAttribution(params)) return true;

  try {
    return isInternalAdAttribution(
      new URL(attribution?.landingPath || "/", "https://triggerfeed.com").searchParams,
    );
  } catch {
    return false;
  }
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

    const visitorId = createRandomVisitorId();
    window.localStorage.setItem(ATTRIBUTION_VISITOR_KEY, visitorId);
    return visitorId;
  } catch {
    return createRandomVisitorId();
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
      isStoredInternalAd(attribution) ||
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
  if (!attribution?.visitorId || !attribution?.source || isStoredInternalAd(attribution)) {
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
