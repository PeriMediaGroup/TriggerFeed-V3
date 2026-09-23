# External acquisition / internal ad separation

## Root cause

`src/features/ads/adHelpers.js` adds `utm_medium=in-feed-ad` to ad URLs and also adds `source=triggerfeed&campaign=<ad_id>` for TriggerFeed destinations. `AttributionTracker` accepted every normalized `source` through `parseAttributionParams`, saved it as first touch, and called `record_marketing_attribution_visit`. The marketing reports then aggregated all visits. Internal impressions/clicks already have a separate `record_ad_event` path.

## Fix

- `src/features/marketing/attribution.js` rejects the reserved `triggerfeed` source or the explicit `in-feed-ad` medium before the tracker creates/stores attribution or calls the marketing RPC. Campaign values are never classified by UUID shape.
- Storage reads discard previously cached internal first touch, preventing signup metadata from reusing it. Storage writes reject internal attribution directly. A legitimate external first touch survives subsequent internal ad clicks. The shared visitor ID remains unchanged, including its use by internal ad delivery.
- Forward-only migration `20260923094339_exclude_internal_ad_marketing_attribution.sql` adds the same source/canonical ad-medium guard to the recording RPC before any writes or landing-path truncation.
- All three reporting RPCs (totals, source/campaign summary, device breakdown) exclude internal traffic before aggregation, including unique visitors and registrations. SQL matches the actual ad builder's query parameter with parameter boundaries, not arbitrary URL substrings or fragments.
- Historical rows and visitor/conversion records are retained. No cleanup DELETE is included: deleting visits alone would leave first-touch history inconsistent. PSA, Sawmill, and other external sources remain reportable, including campaigns with UUID names.
- Ad generation, delivery, impression/click recording, RLS, and dashboard admin authorization are unchanged. The new predicate is not directly callable by client roles.

## Verification

- `npm run lint`, `npx tsc --noEmit`, `npm run build`: passed.
- `npx vitest run`: 116 tests passed in 10 files, including 13 new tracker/storage regressions and existing ad helper/session tests.
- Applied the migration SQL directly to the local Docker database for validation; no production database was contacted or modified, and this direct local execution did not register a migration-history entry.
- `supabase/tests/marketing_internal_ad_exclusion.sql`: passed locally, with all fixtures rolled back. Covers anonymous RPC recording/rejection, legitimate external UUID campaigns, no internal first-touch creation, all three report aggregates, historical row retention, and authorization/helper permissions.
- `npx supabase db lint --local --level warning --fail-on error`: no schema errors or warnings.
- `npx supabase db advisors --local --type security --level warn --fail-on error`: no issues found.
- The existing `custom_ads_v1.sql` suite could not run because the local database lacks `public.ads`. Its transaction aborted before ad fixtures were created. Live ad impression/click behavior was not exercised; the existing ad code and RPC definitions were not modified.

## Release

Deploy the web changes and apply the forward-only migration through the normal migration release process. The migration makes historical dashboard results external-only and blocks stale clients from recording canonical internal-ad URLs. Until it is applied in production, existing dashboard aggregates there remain unchanged. No production deployment or remote migration was performed in this task.
