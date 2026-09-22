# Creator / Organization V1 completion and release notes

Implemented in the separate web and Android repositories. No remote migration, deployment, commit, push, or OTA publication was performed.

## Migration and database contracts

`supabase/migrations/20260921142947_creator_organization_v1.sql`

- Adds authoritative `profiles.profile_type` to `get_my_profile()`, `get_public_profile(uuid)`, and `get_public_profile_cards(uuid[])`, retaining existing field privacy projections. Existing metadata loaders and signup metadata remain authoritative.
- Adds `profile_follows` with cascading profile foreign keys, composite primary key, self-follow check, follower/following ordering indexes, RLS, and SELECT-only client grants. All writes go through the authenticated RPC.
- `set_profile_follow(p_profile_id, p_follow)`: idempotent authenticated follow/unfollow; caller cannot supply another follower identity. Rejects self-follow, absent/deleted/banned/system targets and inactive callers. No friendship changes.
- `get_profile_follow_summary(p_profile_id)`: visible follower/following counts plus the current viewer's follow state.
- `get_profile_follow_list(p_profile_id, p_direction, p_offset, p_limit)`: privacy-filtered public cards, 25 per UI page, maximum 50 per RPC page. Uses the existing profile visibility helper; does not introduce a separate private-account policy.
- `get_following_post_ids(p_limit)`: SECURITY INVOKER, existing post RLS, visible public nondeleted posts from active followed profiles, filtered before the limit. Web and Android use the same contract, retain sticky/recent ordering and existing hydration, and show up to 50 posts.
- `is_follow_profile_available(p_profile_id)`: narrow eligibility helper used by RLS and specialized profile content loading.
- Adds `verified-creator` and `verified-organization` to the existing badges infrastructure. Migrates existing admin-granted generic verification to the matching badge, without verifying signup accounts.
- `set_profile_verification(p_user_id, p_verified)` uses the existing admin/CEO helper and badge award/revoke functions. A badge trigger checks every award path against the account type. Changing type removes identity verification. Badge changes record existing `moderation_actions` admin-note events with operation and slug metadata.
- Roles, account_type, Founding 500 assignment/registry, moderation permissions, auth, and friendship contracts remain independent.

## Web and Android behavior

Both surfaces reuse existing profile headers, banners, avatars, identity metadata, badge sections, and post rendering. Organization profiles use a logo treatment and organization labels; creators get creator labels. Member-specific presentation stays in place. Specialized profiles now show recent content (up to 20 posts), follow controls, counts, paginated lists, loading/error/empty states, and type-specific verification labels.

The new `ProfileFollows` and `ProfilePosts` components are packaged separately in each repository. Web lists reuse `FriendsList` with configurable heading and optional friend-specific action. Android uses its existing profile navigation and `PostCard`.

One profile-link normalizer per platform serves both specialized types. Identical cross-platform tests cover HTTPS-only URLs, malformed metadata, credential-bearing and unsafe URLs, deduplication, recognized service labels, aliases, and lookalike domains. Supports website, YouTube, Instagram, Facebook, X, TikTok, Twitch, Rumble, and other links. Web external links use `noopener noreferrer`; Android uses the existing external browser API and handles open failures.

Web feed comment and author hydration now uses bounded batches, and post mentions are resolved together, avoiding per-post query growth. The single-post comment query delegates to the same implementation.

Admin user cards retain the current identity/type editor and gain type-specific verification actions through the new RPC. Founding badges continue to render alongside verification. An unrelated pre-existing Android build blocker was fixed by wiring the utility menu to its existing `openExternalUrl` handler.

## Validation

- Migration and its missing prerequisites applied successfully in a separate local database cloned from the running local stack. The original stack/database was not migrated or stopped.
- `supabase/tests/creator_organization_v1.sql`: passed under actual anon/authenticated SQL roles. Covers signup classification, no automatic verification, private-field projections, self/duplicate/invalid/spoofed follows, counts, lists/pagination, following posts, unfollow, banned/deleted accounts, unauthorized verification, wrong-type badges, admin/CEO controls, revocation, audit, type changes, unchanged roles, and Founding badge coexistence.
- Existing `privacy_rls_audit.sql` and `founding_500.sql`: passed. Updated the old Founding test's expected error wording to match the existing specialized-type migration; no Founding assignment logic changed.
- Database lint of public schema: no errors.
- Web: ESLint, 58 Vitest tests (including both platform link helpers), and production build.
- Android: TypeScript, Expo ESLint, and Android JavaScript/Hermes bundle export.
- Interactive authenticated browser/device flows and an installed Android/native build have not been exercised. Check these on a preview after applying the migration before releasing to production.

## Commands

Run database commands from the web repository, never from a root workspace.

### Local database

The current machine has an older stack named `TriggerFeed_V3` on the configured ports, while `web/supabase/config.toml` uses `triggerfeed-v3`. For the existing isolated validation database, rerun the exact tests without changing either app's configured database:

```powershell
Set-Location C:\Users\petes\PeriMediaGroup\TriggerFeed_V3\web
Get-Content -Raw supabase/tests/creator_organization_v1.sql | docker exec -i supabase_db_TriggerFeed_V3 psql -U postgres -d tf_creator_v1_validation -v ON_ERROR_STOP=1
Get-Content -Raw supabase/tests/privacy_rls_audit.sql | docker exec -i supabase_db_TriggerFeed_V3 psql -U postgres -d tf_creator_v1_validation -v ON_ERROR_STOP=1
Get-Content -Raw supabase/tests/founding_500.sql | docker exec -i supabase_db_TriggerFeed_V3 psql -U postgres -d tf_creator_v1_validation -v ON_ERROR_STOP=1
npx supabase db lint --db-url postgresql://postgres:postgres@127.0.0.1:54322/tf_creator_v1_validation --schema public --level error --fail-on error
```

For normal CLI-managed local migration testing, first resolve the stack-name/port conflict. If you choose to stop the older stack (its volumes are preserved), the commands are:

```powershell
npx supabase stop --project-id TriggerFeed_V3
npx supabase start
npx supabase migration up --local
npx supabase db lint --local --level error --fail-on error
Get-Content -Raw supabase/tests/creator_organization_v1.sql | docker exec -i supabase_db_triggerfeed-v3 psql -U postgres -d postgres -v ON_ERROR_STOP=1
```

Do not reset a database containing local work just to test this feature. The isolated validation above tested the incremental migration against a local snapshot plus the prerequisite migrations, not a fresh replay of every historical migration.

### Remote Supabase migration

Apply database changes before deploying either client. Use the already-linked intended project; inspect the dry run, which can include other pending migrations:

```powershell
Set-Location C:\Users\petes\PeriMediaGroup\TriggerFeed_V3\web
npx supabase migration list --linked
npx supabase db push --dry-run
npx supabase db push
npx supabase db lint --linked --level error --fail-on error
```

### Web validation

```powershell
Set-Location C:\Users\petes\PeriMediaGroup\TriggerFeed_V3\web
npm run lint
npx vitest run
npm run build
```

### Android validation and optional native build

```powershell
Set-Location C:\Users\petes\PeriMediaGroup\TriggerFeed_V3\app
npx tsc --noEmit
npm run lint
npx expo export --platform android --output-dir .expo/creator-v1-export
# Optional installed-device/native validation:
npm run android
# Optional cloud preview binary:
npx eas-cli build --platform android --profile preview
```

### OTA

This feature adds no native dependencies. OTA is appropriate for installed builds with a compatible runtime/channel after the database migration and preview validation. The environment flag is required for this Expo SDK:

```powershell
Set-Location C:\Users\petes\PeriMediaGroup\TriggerFeed_V3\app
npx eas-cli update --channel preview --platform android --environment preview --message "Creator and Organization V1"
# After validating preview on an installed device:
npx eas-cli update --channel production --platform android --environment production --message "Creator and Organization V1"
```

## Intentionally deferred

Paid verification, monetization, payouts, subscriptions, ads/billing, creator analytics, public verification applications, custom themes/HTML, messaging changes, recommendations, and follow notifications are excluded as requested. No new native dependencies. No schema copies or root workspace were created.

## Web file manifest

- `src/app/feed/page.js`
- `src/app/page.js`
- `src/app/profile/page.jsx`
- `src/app/profiles/[userId]/page.jsx`
- `src/features/admin/actions/moderationActions.js`
- `src/features/admin/components/AdminUserCard.jsx`
- `src/features/comments/queries.js`
- `src/features/feed/components/FeedPage.jsx`
- `src/features/feed/components/FeedTabs.jsx`
- `src/features/friends/components/FriendsList.jsx`
- `src/features/posts/data/getPosts.js`
- `src/features/profiles/components/ProfileBadgesSection.jsx`
- `src/features/profiles/components/ProfileFollows.jsx`
- `src/features/profiles/components/ProfileHeader.jsx`
- `src/features/profiles/components/ProfilePosts.jsx`
- `src/features/profiles/components/ProfileTypeDetails.jsx`
- `src/features/profiles/lib/profileLinks.js`
- `src/features/profiles/lib/profileLinks.test.js`
- `src/features/profiles/styles/__profile-header.scss`
- `supabase/migrations/20260921142947_creator_organization_v1.sql`
- `supabase/tests/creator_organization_v1.sql`
- `supabase/tests/founding_500.sql`
- `docs/creator-organization-v1.md`

## Android file manifest

- `src/app/(tabs)/profile.tsx`
- `src/app/profile/[userId].tsx`
- `src/components/AppHeader.tsx`
- `src/features/feed/api/getHomeFeed.ts`
- `src/features/feed/components/FeedList.tsx`
- `src/features/feed/components/FeedTabs.tsx`
- `src/features/feed/types.ts`
- `src/features/profiles/api/getMyProfileDashboard.ts`
- `src/features/profiles/api/getPublicProfileCards.ts`
- `src/features/profiles/components/ProfileFollows.tsx`
- `src/features/profiles/components/ProfilePosts.tsx`
- `src/features/profiles/components/ProfileTypeDetails.tsx`
- `src/features/profiles/utils/profileLinks.ts`
