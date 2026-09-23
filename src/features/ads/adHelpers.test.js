import { describe, expect, it, vi } from "vitest";
import * as web from "./adHelpers";
import * as android from "../../../../app/src/features/ads/adHelpers";
import * as webSession from "./adSession";
import * as androidSession from "../../../../app/src/features/ads/adSession";
const ad = { ad_id: "campaign-id", creative_id: "creative-id", destination_url: "https://triggerfeed.com/merch", frequency: 7 };
describe.each([["web", web], ["android", android]])("%s ads", (_platform, api) => {
  it("uses existing attribution parameters for house destinations", () => {
    const url = new URL(api.adDestination(ad));
    expect(url.searchParams.get("source")).toBe("triggerfeed");
    expect(url.searchParams.get("campaign")).toBe("campaign-id");
    expect(url.searchParams.get("utm_content")).toBe("creative-id");
  });
  it("adds UTM parameters to partner URLs and preserves query and fragment", () => {
    const url = new URL(api.adDestination({ ...ad, destination_url: "https://example.com/training?course=1#book" }));
    expect(url.searchParams.get("utm_medium")).toBe("in-feed-ad");
    expect(url.searchParams.get("course")).toBe("1");
    expect(url.hash).toBe("#book");
    expect(url.searchParams.has("source")).toBe(false);
  });
  it.each(["javascript:alert(1)", "data:text/html,test", "http://example.com", "https://user:pass@example.com", "invalid"])("rejects unsafe destination %s", (destination_url) => {
    expect(api.adDestination({ ...ad, destination_url })).toBeNull();
  });
});

describe.each([["web", webSession], ["android", androidSession]])("%s feed session", (_platform, api) => {
  function delivery() {
    let id = 0;
    return vi.fn(async (count) => Array.from({ length: count }, () => ({
      ...ad, ad_id: `campaign-${id % 2}`, delivery_id: `ticket-${id++}`,
    })));
  }

  it("draws a new bounded interval for each slot, including 6 and 9", async () => {
    const samples = [0.25, 0.999999, 0, 0.5];
    let index = 0;
    const session = api.createAdSession(() => samples[index++ % samples.length]);
    const slots = await session.fill(300, delivery());
    expect(slots.slice(0, 4).map((slot) => slot.after)).toEqual([7, 16, 22, 30]);
    const gaps = slots.map((slot, i) => slot.after - (slots[i - 1]?.after || 0));
    expect(Math.min(...gaps)).toBe(api.MIN_POSTS_BETWEEN_ADS);
    expect(Math.max(...gaps)).toBe(api.MAX_POSTS_BETWEEN_ADS);
    expect(new Set(gaps).size).toBe(4);
  });

  it("preserves positions and ticket identities across rerenders and appended pages", async () => {
    const random = vi.fn(() => 0.25);
    const session = api.createAdSession(random);
    const fetchAds = delivery();
    const first = await session.fill(14, fetchAds);
    const draws = random.mock.calls.length;
    expect(await session.fill(14, fetchAds)).toEqual(first);
    expect(random).toHaveBeenCalledTimes(draws);
    expect(fetchAds).toHaveBeenCalledTimes(1);
    const appended = await session.fill(140, fetchAds);
    expect(appended.slice(0, first.length)).toEqual(first);
    expect(appended).toHaveLength(20);
    expect(new Set(appended.map((slot) => slot.ad.delivery_id)).size).toBe(20);
    expect(fetchAds.mock.calls.every(([count]) => count <= api.AD_DELIVERY_BATCH_SIZE)).toBe(true);
    expect(fetchAds.mock.calls[1][1]).toBe(first.at(-1).ad.ad_id);
    // Shrinking the organic dataset does not reshuffle retained slots or refetch.
    expect(await session.fill(14, fetchAds)).toEqual(first);
    expect(await session.fill(140, fetchAds)).toEqual(appended);
  });

  it("allows a campaign to return later and a sole campaign to fill a long feed", async () => {
    const alternate = await api.createAdSession(() => 0).fill(180, delivery());
    expect(alternate.slice(0, 3).map((slot) => slot.ad.ad_id)).toEqual(["campaign-0", "campaign-1", "campaign-0"]);
    let id = 0;
    const sole = await api.createAdSession(() => 0).fill(180, async (count) =>
      Array.from({ length: count }, () => ({ ...ad, delivery_id: String(id++) })));
    expect(sole).toHaveLength(30);
    expect(new Set(sole.map((slot) => slot.ad.delivery_id)).size).toBe(30);
    expect(new Set(sole.map((slot) => slot.ad.ad_id)).size).toBe(1);
  });

  it("does not request ads before the first gap, and stops when none are eligible", async () => {
    const fetchAds = vi.fn(async () => []);
    const session = api.createAdSession(() => 0);
    expect(await session.fill(5, fetchAds)).toEqual([]);
    expect(fetchAds).not.toHaveBeenCalled();
    expect(await session.fill(100, fetchAds)).toEqual([]);
    expect(fetchAds).toHaveBeenCalledTimes(1);
  });

  it("serializes concurrent appends without duplicate slots", async () => {
    const session = api.createAdSession(() => 0);
    const fetchAds = delivery();
    const [first, second] = await Promise.all([session.fill(12, fetchAds), session.fill(24, fetchAds)]);
    expect(first.map((slot) => slot.after)).toEqual([6, 12]);
    expect(second.map((slot) => slot.after)).toEqual([6, 12, 18, 24]);
    expect(second.slice(0, 2)).toEqual(first);
    expect(fetchAds.mock.calls.map(([count]) => count)).toEqual([2, 2]);
  });

  it("resumes a partial batch after an empty pool without redrawing gaps or losing rotation context", async () => {
    const random = vi.fn(() => 0.25);
    const session = api.createAdSession(random);
    const firstAd = { ...ad, ad_id: "campaign-a", delivery_id: "first" };
    const fetchAds = vi.fn()
      .mockResolvedValueOnce([firstAd])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { ...ad, ad_id: "campaign-b", delivery_id: "second" },
        { ...ad, ad_id: "campaign-a", delivery_id: "third" },
      ]);

    const partial = await session.fill(21, fetchAds);
    expect(partial).toEqual([{ after: 7, ad: firstAd }]);
    const draws = random.mock.calls.length;
    const resumed = await session.fill(21, fetchAds);
    expect(random).toHaveBeenCalledTimes(draws);
    expect(resumed.map((slot) => slot.after)).toEqual([7, 14, 21]);
    expect(resumed[0]).toBe(partial[0]);
    expect(resumed.map((slot) => slot.ad.delivery_id)).toEqual(["first", "second", "third"]);
    expect(fetchAds.mock.calls).toEqual([[3, null], [2, "campaign-a"], [2, "campaign-a"]]);
  });

  it("discards stale responses on refresh/unmount and recovers after request errors", async () => {
    const session = api.createAdSession(() => 0);
    let active = true;
    expect(await session.fill(12, async () => {
      active = false;
      return [{ ...ad, delivery_id: "stale" }];
    }, () => active)).toEqual([]);
    await expect(session.fill(12, async () => { throw new Error("offline"); })).rejects.toThrow("offline");
    expect((await session.fill(12, delivery())).map((slot) => slot.after)).toEqual([6, 12]);
    const refreshed = await api.createAdSession(() => 0.99).fill(18, delivery());
    expect(refreshed.map((slot) => slot.after)).toEqual([9, 18]);
  });
});
