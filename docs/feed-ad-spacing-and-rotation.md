# Feed ad spacing and rotation

Implemented in the separate `/web` and `/app` repositories. No commit, push, remote migration, deployment, or production campaign change was performed. Pre-existing admin/profile/mobile changes were preserved.

## Behavior and shared contract

- `MIN_POSTS_BETWEEN_ADS = 6` and `MAX_POSTS_BETWEEN_ADS = 9` live in each repo's `src/features/ads/adSession` module (`.js` on web, `.ts` on Android). Each gap is a fresh uniform integer, including the gap before the first ad. This replaces the old per-campaign fixed insertion frequency; its stored field/admin control is retained for compatibility but no longer determines feed spacing.
- `createAdSession().fill(postCount, fetchAds, isActive)` retains organic-position boundaries and filled delivery tickets. It generates only the additional boundaries needed, including the next pending boundary, and requests only unfilled slots, in batches of at most eight. It never mutates the organic dataset. Serializing overlapping fills prevents duplicate slot allocation.
- These are equivalent small helpers with the same contract and shared parameterized tests, not a new root workspace or runtime dependency between repos. Campaign rotation is implemented once in the existing backend RPC.
- The delivery RPC excludes the immediately previous **campaign**, rather than just its creative, whenever another eligible campaign exists. It retains weighted selection among the remaining candidates, allows the sole eligible campaign to repeat, and carries its last selection across each batch. The client supplies that last campaign when requesting the next batch.
- There is no session-wide exclusion set. A campaign can return later, including across more than eight slots. Every occurrence gets its own delivery ticket so existing per-ticket impression/click deduplication remains valid.
- Status, start/end dates, enabled feed placement, platform creative compatibility/preference, visitor attribution, and platform values remain in the existing delivery path. Impression/card/click implementations are unchanged.

## Web

`FeedAdsProvider` owns one session in lazy React state. Rendering does not draw new gaps or replace existing tickets. Appending posts fills only additional slots; a smaller count hides slots outside the current dataset. The provider key includes feed type and viewer identity to prevent reusing another viewer's delivery tickets. Unmount/effect cleanup discards stale responses. A full reload creates a new session; an ordinary server refresh may retain the existing sequence.

`PostFeed` still maps the original posts and retains their IDs, keys, references, and organic indexes. `FeedAdSlot` remains a presentation addition after each organic position.

## Android

`FeedList` creates a fresh session after a successful feed load, including pull-to-refresh and focus/feed changes. It stores completed slots in state and merges them into the existing FlatList presentation rows. Ordinary rerenders and post deletions do not redraw the sequence. Existing generation/mount guards discard older feed/ad results, and refresh still completes independently of ad loading. Platform remains `android`; non-Android delivery remains disabled.

The current feed APIs on both surfaces return capped snapshots, not cursor-based infinite scrolling. Their queries, limits, ordering and post IDs were not changed. Append behavior is tested at the session and actual presentation-component level; no new pagination system was introduced.

## Migration and deployment dependency

`supabase/migrations/20260923015706_feed_ad_rotation.sql`

The existing RPC samples with replacement, so filtering a returned batch cannot guarantee non-repetition when another eligible campaign exists outside that sample. The migration adds optional `p_previous_campaign_id uuid default null` to `get_feed_ads` and updates selection. It changes no tables, campaign schema, RLS policies, admin permissions, or event RPCs.

The old four-argument function is replaced atomically with one defaulted five-argument function. Existing callers can omit the new parameter; anon/authenticated execute grants are explicitly retained. A single function avoids ambiguous API overloads, consistent with the [Supabase function guidance](https://supabase.com/docs/guides/database/functions). PostgREST schema reload is requested after the migration.

**Remote application requires explicit approval and has not been performed.** After approval, apply this migration through the normal reviewed deployment workflow before releasing the new clients. It depends on Custom Ads V1 already being present. New clients against the old RPC receive a delivery error and show the organic feed without new ads; they do not fall back to repetition-prone selection.

## Files changed for this task

Web:

- `src/features/ads/adSession.js` — spacing constants and persistent fill contract.
- `src/features/ads/FeedAds.jsx` — session lifecycle and previous-campaign RPC argument.
- `src/features/ads/adHelpers.js` — removes fixed-spacing helper; destination attribution retained.
- `src/features/ads/adHelpers.test.js` — shared web/Android session tests and retained destination tests.
- `src/features/ads/feedInsertion.test.jsx` — actual feed-component presentation/refresh tests with native dependencies mocked.
- `src/features/feed/components/FeedPage.jsx` — viewer-aware session key.
- `supabase/migrations/20260923015706_feed_ad_rotation.sql` — eligible weighted rotation.
- `supabase/tests/feed_ad_rotation.sql` — rollback-only rotation/eligibility tests.
- `docs/feed-ad-spacing-and-rotation.md` — this report.

Android:

- `src/features/ads/adSession.ts` — typed equivalent session helper.
- `src/features/ads/adHelpers.ts` — removes fixed-spacing helper.
- `src/features/ads/api.ts` — accepts batch count and previous campaign.
- `src/features/feed/components/FeedList.tsx` — stores session slots and refreshes through the existing load lifecycle.

## Validation

Passed from `/web`:

- `npx vitest run`: **103 tests across nine files**. The existing runner also executes Android helpers and mocked native feed components.
- `npm run lint`.
- `npx tsc --noEmit`.
- `npm run build`.
- `git diff --check`.
- New migration applied only to isolated local Docker database `tf_creator_v1_validation`.
- Rollback-only `supabase/tests/custom_ads_v1.sql` and `supabase/tests/feed_ad_rotation.sql`, with `ON_ERROR_STOP=1`: both passed.
- Local public-schema Supabase lint and security advisors at error level with `--fail-on error`: no findings.

Passed from `/app`:

- `npx tsc --noEmit`.
- `npm run lint` (Expo lint).
- `npx expo export --platform android --output-dir C:\Users\petes\AppData\Local\Temp\triggerfeed-ad-rotation-export`.
- `git diff --check`.

New coverage includes every gap from 6 through 9, variable intervals in one feed, stable rerenders, append/shrink behavior, serialized overlapping fills, stale responses, request failure recovery, fresh refresh sequences, more than eight slots, unique repeat tickets, organic IDs/order/reference preservation, and Android pull-to-refresh race handling. Database tests verify actual rotation on all three platforms, across batch boundaries, despite skewed campaign weights, plus sole-campaign fallback when alternatives are paused, future, expired, disabled, or platform-incompatible. Existing SQL tests cover tracking, ticket authorization, eligibility and management restrictions.

## Deferred

Remote deployment and a live browser/installed-device walkthrough remain unperformed. UI tests use mocked native dependencies and SQL tests use a local database; they are not a production end-to-end test. No new frequency caps, configuration UI, billing, targeting, advertiser types, or separate house-ad system were added.

## Follow-up verification of the repeated request — September 23, 2026

The attached request was checked against the current implementation in both repositories. The spacing/session helpers, feed integrations, delivery migration, and original regression suites were already present and satisfy the requested behavior; no replacement implementation or additional migration was needed.

This follow-up changes only this report and `src/features/ads/adHelpers.test.js`. The shared parameterized suite now additionally proves that a partial delivery followed by an empty eligible pool can resume without redrawing gaps, replacing existing tickets, or losing the immediately previous campaign at the retry boundary. That regression runs against both Web and Android helpers.

Fresh validation:

- Web: lint, TypeScript, production build, and **118 unit tests across 10 files** passed. The changed test file also passed its lint check after the addition.
- Android: Expo lint, TypeScript, and Android export passed. Export artifact: `C:/Users/petes/AppData/Local/Temp/triggerfeed-ad-rotation-recheck-export`.
- Both existing SQL suites, `custom_ads_v1.sql` and `feed_ad_rotation.sql`, passed against the isolated local `tf_creator_v1_validation` database. All test fixtures rolled back.
- Database lint at warning level found no errors, but reported two existing warnings in `get_feed_ads`: the explicitly declared `slot` variable is unused and is shadowed by PL/pgSQL's implicit integer-loop variable. These do not affect selection; no extra migration was added solely for this cosmetic declaration issue. The earlier error-level validation above remains accurate.
- Local security advisors reported no issues at warning/error level.
- Organic feed queries remain capped snapshots. Presentation append/refresh behavior is tested; this does not claim a cursor-pagination or installed-device test where none exists.

The existing rotation migration still requires the normal approved production rollout before the new clients are released. This follow-up did not inspect or change remote migration state, apply any remote migration, commit, or push. Existing mobile working-tree changes were preserved.
