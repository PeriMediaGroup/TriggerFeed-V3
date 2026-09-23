// Keep this contract aligned with app/src/features/ads/adSession.ts.
// Both implementations run through the same contract tests in adHelpers.test.js.
export const MIN_POSTS_BETWEEN_ADS = 6;
export const MAX_POSTS_BETWEEN_ADS = 9;
export const AD_DELIVERY_BATCH_SIZE = 8;

export function createAdSession(random = Math.random) {
  const positions = [];
  const slots = [];
  let pending = Promise.resolve();

  return {
    // Serialize appends so overlapping effects never refill an existing slot.
    fill(postCount, fetchAds, isActive = () => true) {
      const work = pending.then(async () => {
        if (!isActive()) return slots.filter((slot) => slot.after <= postCount);
        while (!positions.length || positions.at(-1) <= postCount) {
          const gap = MIN_POSTS_BETWEEN_ADS
            + Math.floor(random() * (MAX_POSTS_BETWEEN_ADS - MIN_POSTS_BETWEEN_ADS + 1));
          positions.push((positions.at(-1) || 0) + gap);
        }
        const needed = positions.filter((after) => after <= postCount).length;
        while (slots.length < needed && isActive()) {
          const count = Math.min(AD_DELIVERY_BATCH_SIZE, needed - slots.length);
          // The RPC applies eligibility, weights and previous-campaign exclusion
          // both within this batch and across its boundary with the last batch.
          const ads = await fetchAds(count, slots.at(-1)?.ad.ad_id ?? null);
          if (!isActive() || !ads.length) break;
          for (const ad of ads.slice(0, count)) {
            slots.push({ after: positions[slots.length], ad });
          }
        }
        return slots.filter((slot) => slot.after <= postCount);
      });
      pending = work.catch(() => {});
      return work;
    },
  };
}
