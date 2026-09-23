import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adDestination } from "../ads/adHelpers";
import {
  ATTRIBUTION_STORAGE_KEY,
  parseAttributionParams,
  readStoredAttribution,
  storeFirstTouchAttribution,
} from "./attribution";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), effect: null }));
vi.mock("react", () => ({ useEffect: (effect) => { mocks.effect = effect; } }));
vi.mock("next/navigation", () => ({
  usePathname: () => new URL(window.location.href).pathname,
  useSearchParams: () => new URL(window.location.href).searchParams,
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/features/marketing/attribution", async () => import("./attribution"));
import AttributionTracker from "./AttributionTracker";

const campaign = "a2000000-0000-4000-8000-000000000001";
const internalUrl = adDestination({
  ad_id: campaign, creative_id: "creative-id", destination_url: "https://triggerfeed.com/merch",
});

beforeEach(() => {
  const values = new Map();
  vi.stubGlobal("window", {
    location: { href: "https://triggerfeed.com/", origin: "https://triggerfeed.com" },
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
  });
  vi.stubGlobal("document", { referrer: "" });
  vi.stubGlobal("navigator", { userAgent: "desktop" });
  mocks.rpc.mockReset().mockResolvedValue({ error: null });
});
afterEach(() => vi.unstubAllGlobals());

async function visit(url) {
  window.location.href = new URL(url, window.location.origin).href;
  AttributionTracker();
  await mocks.effect();
}

describe("external acquisition tracker", () => {
  it.each([
    ["psa-register", "og-sticker"], ["psa-range", "business-card"],
    ["psa", "business-card"], ["sawmill", campaign],
  ])("records %s / %s, including external UUID campaigns", async (source, campaignName) => {
    await visit(`/signup?source=${source}&campaign=${campaignName}`);
    expect(mocks.rpc).toHaveBeenCalledWith("record_marketing_attribution_visit", expect.objectContaining({
      p_source: source, p_campaign: campaignName,
    }));
    expect(readStoredAttribution()).toMatchObject({ source, campaign: campaignName });
  });

  it.each([
    internalUrl,
    "/friends?source=triggerfeed&campaign=plain-name",
    "/profile?source=psa&campaign=business-card&utm_medium=in-feed-ad",
    "/merch?source=TriggerFeed&campaign=anything",
    "/merch?source=psa&utm_medium=in-feed-advertisement&campaign=business-card",
  ].slice(0, 4))("does not record or store internal ad URL %s", async (url) => {
    await visit(url);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(readStoredAttribution()).toBeNull();
  });

  it("matches markers exactly, not campaign shapes or medium prefixes", () => {
    expect(parseAttributionParams(new URLSearchParams(`source=psa&campaign=${campaign}&utm_medium=in-feed-advertisement`)))
      .toEqual({ source: "psa", campaign });
  });

  it("preserves real first touch when a later internal ad is clicked", async () => {
    await visit("/signup?source=psa&campaign=business-card");
    const first = readStoredAttribution();
    await visit(internalUrl);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(readStoredAttribution()).toEqual(first);
  });

  it.each([
    { source: "triggerfeed", landingPath: "/merch" },
    { source: "psa", landingPath: "/friends?utm_medium=in-feed-ad" },
  ])("discards stale internal first touch before signup or a new external visit", async (internal) => {
    window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify({
      ...internal, visitorId: campaign, firstSeenAt: Date.now(),
    }));
    expect(readStoredAttribution()).toBeNull();
    expect(window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY)).toBeNull();
    await visit("/signup?source=psa-register&campaign=og-sticker");
    expect(readStoredAttribution()?.source).toBe("psa-register");
  });

  it("rejects internal attribution when storage is called directly", () => {
    expect(storeFirstTouchAttribution({ visitorId: campaign, source: "triggerfeed" })).toBeNull();
  });
});
