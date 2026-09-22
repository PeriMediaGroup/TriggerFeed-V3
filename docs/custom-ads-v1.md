# Custom Ads V1 implementation report

Implemented in the separate web and Android repositories. No remote migration, deployment, commit, or push was performed.

## Files changed

Web additions:
- `supabase/migrations/20260922015135_custom_ads_v1.sql`
- `supabase/tests/custom_ads_v1.sql`
- `src/features/ads/{FeedAds.jsx,AdminAdsPanel.jsx,adHelpers.js,adHelpers.test.js,_ads.scss}`
- `src/app/admin/ads/page.jsx`
- `docs/custom-ads-v1.md`

Web integration edits:
- `src/features/feed/components/FeedPage.jsx`
- `src/features/posts/components/PostFeed.jsx`
- `src/features/admin/components/AdminSectionNav.jsx`
- `src/styles/globals.scss`

Android additions:
- `src/features/ads/{types.ts,api.ts,adHelpers.ts,FeedAdCard.tsx}`

Android integration edit: `src/features/feed/components/FeedList.tsx`. Other pre-existing mobile Creator/Organization changes were preserved.

## Migration and schema

The forward-only migration adds `ads`, `ad_creatives`, `ad_placements`, `ad_deliveries`, `ad_impressions`, and `ad_clicks`. Campaigns have status/date constraints and HTTPS destinations. Creatives support all, web_desktop, web_mobile, and android. Feed placements support frequency 6-8 and weighted selection. Event tables carry campaign, creative, user, existing marketing visitor, platform, placement, and timestamps, with reporting indexes.

Delivery rows are short-lived capability tickets, not impressions. Tickets expire after one day. Each ticket permits at most one impression and one click; event dimensions are derived server-side. Anonymous tickets require anonymous callers; authenticated tickets are bound to the requesting user. The event RPC checks current campaign eligibility again.

All six tables have RLS. Public/member/moderator callers cannot browse raw analytics or write tables. Existing admin/CEO authorization is reused. Management writes go through guarded RPCs.

## Functions

- `ad_https_url_valid(text)`: URL constraint helper.
- `get_feed_ads(platform, placement, limit, visitor_id)`: safe eligible delivery, max eight tickets, exact-platform creative preferred over all, weighted campaign ordering.
- `record_ad_event(delivery_id, event)`: controlled, idempotent impression/click recording.
- `save_ad_campaign(ad, creative, placement)`: atomic admin campaign/creative/feed-placement editing.
- `set_ad_status(ad_id, status)`: admin lifecycle control.
- `get_admin_ads_dashboard()`: admin summary and campaign analytics.

## Web and Android

Web inserts reusable, disclosed ad cards after configured groups of organic posts. Impressions require at least 50% viewport visibility for one second while the document is visible. Clicks attempt tracking before navigation, with a timeout so tracking failure cannot block the destination.

Android UI is implemented, using the same backend with platform android. FlatList viewability requires 50% visibility for one second; tracking also checks foreground and screen focus. Existing organic post rendering, keys, retrieval, refresh, and ordering are retained. Current feeds use capped snapshots rather than cursor pagination; no pagination contract was changed.

Web reuses the existing marketing visitor ID. Native uses authenticated identity without introducing a competing visitor ID. Destination helpers preserve existing URL parameters and add UTM parameters; house destinations also include source/campaign for existing attribution compatibility. Legacy sidebar ads are unchanged.

## Admin and initial campaigns

`/admin/ads` is restricted to admin/CEO and includes create/edit, creative selection/addition, activate/pause/end, dates, placement frequency/weight, and required campaign/platform metrics and CTR.

The migration prepares Shirt and Stickers as **drafts**, reusing the existing merch URL and images. Activate them through the admin page after migration deployment and review.

## Validation performed

- Migration applied successfully to isolated local database `tf_creator_v1_validation`; no remote production changes.
- Rollback SQL integration test passed: actual anon/authenticated roles; admin/CEO allowed; member/moderator denied management; raw analytics restricted; inactive/future/expired/disabled/incompatible delivery excluded; all three platform cases; no fetch impressions; event dedupe, forged/expired tickets, and cross-user rejection.
- Local public-schema database lint passed with no error findings.
- Web lint passed after temporary generated verification output was moved outside the repository.
- Vitest: 76 tests in six files passed, including both web/native destination and insertion helpers.
- Next.js production build and TypeScript validation passed.
- Android TypeScript and Expo lint passed; Android production bundle export passed.
- Desktop and Android-user-agent mobile-web browser checks passed using mocked RPC responses: no offscreen impressions, visible impressions, revisit dedupe, click recording, navigation, platform distinction, attribution, and no page errors. These are UI contract checks, not production end-to-end tests.
- Temporary browser fixture and config changes removed. Both repositories pass `git diff --check`.

## Intentionally deferred and remaining runtime checks

No billing, advertiser self-service, budgets, auctions, third-party networks, demographic/geographic targeting, sponsor dashboards, conversion reporting, or new placements. No auth, Founding 500, or profile behavior changes.

Remote migration and campaign activation remain unapplied as requested. An installed Android device visibility/navigation check and authenticated admin browser walkthrough against the deployed migration remain unverified. The local SQL suite verifies admin authorization and operations. Event ingestion prevents accidental duplicates, not determined fraud; delivery/event retention and production rate limiting are follow-up operational work.
