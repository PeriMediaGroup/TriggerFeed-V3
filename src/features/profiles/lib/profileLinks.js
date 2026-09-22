const SERVICES = { youtube: "YouTube", instagram: "Instagram", facebook: "Facebook", x: "X", twitter: "X", tiktok: "TikTok", twitch: "Twitch", rumble: "Rumble", website: "Website", other: "Other" };
export function safeProfileUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
export function normalizeProfileLinks(metadata = {}) {
  const input = [
    { url: metadata.website_url, service: "website" },
    { url: metadata.primary_link_url, label: metadata.primary_link_label },
    ...(Array.isArray(metadata.social_links) ? metadata.social_links : []),
  ];
  const seen = new Set();
  return input.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const href = safeProfileUrl(item.url);
    if (!href || seen.has(href)) return [];
    seen.add(href);
    const host = new URL(href).hostname.replace(/^www\./, "");
    const domains = { "youtube.com": "youtube", "youtu.be": "youtube", "instagram.com": "instagram", "facebook.com": "facebook", "x.com": "x", "twitter.com": "x", "tiktok.com": "tiktok", "twitch.tv": "twitch", "rumble.com": "rumble" };
    const inferred = Object.entries(domains).find(([domain]) => host === domain || host.endsWith(`.${domain}`))?.[1];
    const requested = typeof (item.service || item.type) === "string" ? (item.service || item.type).toLowerCase() : "";
    const service = inferred || (Object.hasOwn(SERVICES, requested) ? requested : "other");
    const custom = typeof item.label === "string" ? item.label.trim().slice(0, 80) : "";
    return [{ href, service, label: service !== "other" ? SERVICES[service] : custom && !/:\/\//.test(custom) ? custom : "External link" }];
  });
}
