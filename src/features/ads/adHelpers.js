export function adDestination(ad) {
  try {
    const url = new URL(ad.destination_url);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    url.searchParams.set("utm_source", "triggerfeed");
    url.searchParams.set("utm_medium", "in-feed-ad");
    url.searchParams.set("utm_campaign", ad.ad_id);
    url.searchParams.set("utm_content", ad.creative_id);
    if (["triggerfeed.com", "www.triggerfeed.com"].includes(url.hostname)) {
      url.searchParams.set("source", "triggerfeed");
      url.searchParams.set("campaign", ad.ad_id);
    }
    return url.href;
  } catch { return null; }
}
export function planAdSlots(postCount, ads) {
  let after = 0;
  return ads.flatMap((ad) => {
    after += Math.min(8, Math.max(6, Number(ad.frequency) || 7));
    return after <= postCount ? [{ after, ad }] : [];
  });
}
