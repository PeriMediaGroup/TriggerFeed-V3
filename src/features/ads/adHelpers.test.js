import { describe, expect, it } from "vitest";
import * as web from "./adHelpers";
import * as android from "../../../../app/src/features/ads/adHelpers";
const ad = { ad_id: "campaign-id", creative_id: "creative-id", destination_url: "https://triggerfeed.com/merch", frequency: 7 };
describe.each([["web", web], ["android", android]])("%s ads", (_platform, api) => {
  it("keeps organic positions stable across appended pages", () => {
    const ads = Array.from({ length: 8 }, () => ad);
    expect(api.planAdSlots(14, ads).map((slot) => slot.after)).toEqual([7, 14]);
    expect(api.planAdSlots(28, ads).map((slot) => slot.after)).toEqual([7, 14, 21, 28]);
    expect(api.planAdSlots(5, ads)).toEqual([]);
  });
  it("supports bounded configurable frequency without dropping organic rows", () => {
    expect(api.planAdSlots(30, [{ ...ad, frequency: 6 }, { ...ad, frequency: 8 }, { ...ad, frequency: 0 }, { ...ad, frequency: 100 }]).map((slot) => slot.after)).toEqual([6, 14, 21, 29]);
  });
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
