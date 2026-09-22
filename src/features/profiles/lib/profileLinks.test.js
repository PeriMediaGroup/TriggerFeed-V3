import { describe, expect, it } from "vitest";
import * as webLinks from "./profileLinks";
import * as nativeLinks from "../../../../../app/src/features/profiles/utils/profileLinks";

describe.each([["web", webLinks], ["Android", nativeLinks]])("%s profile links", (_platform, { normalizeProfileLinks, safeProfileUrl }) => {
  it.each(["javascript:alert(1)", "data:text/html,test", "http://example.com", "//example.com", "https://user:password@example.com", "not a URL", null, {}])("rejects unsafe or invalid URL %s", (value) => {
    expect(safeProfileUrl(value)).toBeNull();
  });
  it("accepts HTTPS and normalizes host casing", () => {
    expect(safeProfileUrl(" https://EXAMPLE.com/path ")).toBe("https://example.com/path");
  });
  it.each([["youtube.com", "YouTube"], ["youtu.be", "YouTube"], ["instagram.com", "Instagram"], ["facebook.com", "Facebook"], ["x.com", "X"], ["twitter.com", "X"], ["tiktok.com", "TikTok"], ["twitch.tv", "Twitch"], ["rumble.com", "Rumble"]])("labels %s", (domain, label) => {
    expect(normalizeProfileLinks({ social_links: [{ url: `https://${domain}/person` }] })[0].label).toBe(label);
  });
  it("does not mistake lookalike domains for recognized services", () => {
    expect(normalizeProfileLinks({ social_links: [{ url: "https://youtube.com.evil.test" }] })[0].service).toBe("other");
  });
  it("adapts signup label/url arrays, deduplicates and ignores malformed rows", () => {
    const links = normalizeProfileLinks({ website_url: "https://example.com", social_links: [null, 4, {}, { url: "javascript:test" }, { url: "https://example.com/" }, { url: "https://example.org", label: "Portfolio" }] });
    expect(links.map((link) => link.label)).toEqual(["Website", "Portfolio"]);
  });
  it("normalizes explicit service aliases and avoids displaying raw URLs", () => {
    expect(normalizeProfileLinks({ social_links: [{ url: "https://example.com", type: "TWITTER" }, { url: "https://example.org", label: "https://example.org/ugly" }] }).map((link) => link.label)).toEqual(["X", "External link"]);
  });
});
