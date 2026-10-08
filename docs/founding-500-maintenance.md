# Founding 500 maintenance

Scope: `/web` only. Migration: `20261005152059_founding_500_maintenance.sql`.
No production changes, remote migration application, deployment, commit, or push were performed.

## Existing architecture and intentional policy change

The authoritative number is `profiles.founding_member_number`, protected by a partial unique index, a 1–500 check and a profile trigger. `founding_member_numbers` is the matching ledger, keyed by number, with `profile_id`, `assigned_at`, and `released_at`. The badge trigger synchronizes the `founding-500` entry in `user_badges`. The public registry RPC orders by number and hides released slots.

Previously, deleted profiles retained historical slots indefinitely; Organization conversion explicitly released a slot, and assignment reused the lowest released number before allocating above the high-water mark. Assignment timestamp order could therefore differ from number order. The new policy deliberately preserves **current number order**, never timestamp order.

`founding_500_settings.finalized_at` now represents explicit closure. Applying the migration leaves it NULL and does not renumber, remove, backfill, or finalize existing memberships. Auto-assignment enabled/disabled remains a separate rollout switch; neither count nor reaching #500 finalizes the program.

## Operations

| RPC | Access | Behavior |
| --- | --- | --- |
| `remove_founding_500_member(uuid, integer, text)` | Admin/CEO | Requires the target's currently displayed number; rejects stale confirmations and non-founders. Open enrollment requires a consistent, contiguous ledger, removes the target's status/badge and shifts later members by one. Finalized removal retires the number without shifting anyone. |
| `repair_founding_500(text, text)` | CEO | Requires `REPAIR FOUNDING 500`. Open-only compaction of existing retired, released and absent gaps. Reports changed old/new mappings and deleted-profile cleanup. |
| `finalize_founding_500(text, text)` | CEO | Requires `FINALIZE FOUNDING 500`. Requires a consistent, contiguous registry; records finalization and disables assignment. Does not require exactly 500 members. |
| `get_admin_founding_500()` | Admin/CEO | Ledger entries, membership/status/type/dates, assigned/remaining counts, explicit state and repair-needed flag. |
| `get_founding_500_state()` | Public | Only finalization timestamp and auto-assignment state. |

Open Organization conversion retains the existing explicit-release behavior: the lowest released slot can be claimed by an eligible Member/Creator. It does not automatically compact other members. Deletion likewise leaves a historical slot until explicit CEO repair. Normal removal rejects those unrelated gaps instead of silently doing a broader repair.

After finalization, removal and Organization conversion leave an unreleased retired ledger row. Deletion retains its historical row. New automatic or explicit claims cannot allocate any numbers; enabling automatic assignment and clearing/changing finalization are blocked. Repair refuses to run. There is no administrative reopen operation.

## Transaction and collision safety

All membership mutations and settings changes coordinate on the existing transaction advisory lock (`triggerfeed_founding_500`). Statement triggers acquire it before profile tuple locks for insert/delete and relevant updates. The conversion RPC takes it before its existing `SELECT FOR UPDATE`. Assignment, removal, repair and finalization use the same lock.

Normal removal vacates the target's profile number and ledger slot, then visits later rows in ascending number order. Each move is into a destination vacated by the previous move. Unique constraints stay enabled throughout; there is no unordered bulk decrement, out-of-range staging number, deferred uniqueness, or trigger disabling.

Repair snapshots the complete old ledger into JSON, identifies existing matching live membership records, clears Founding state on soft-deleted profiles, and rebuilds the ledger with contiguous numbers. It visits live members in ascending **old number** order, preserves their `assigned_at`, and changes only numbers that differ. A member can only move downward, so each destination is free before its profile update. Retired/released ledger rows are removed only inside this transaction, with their full previous details retained in audit metadata. Any error, including failure to write the audit, rolls everything back.

`founding_500_transitions` is a short-lived database capability table keyed by transaction and profile, containing the exact expected new number. Clients have no table privileges or RLS policies. Only revoked internal functions can populate it. The profile trigger requires that exact capability plus an authenticated administrator before accepting a maintenance transition. Caller-settable GUCs cannot bypass immutability. Successful operations remove the capability; failures roll it back.

Repair is not a backfill: it adds no new profiles to the Founding membership. It preserves existing grandfathered founders rather than retroactively applying the internal-domain exclusion. Current assignment still excludes both internal domains, Organization/System and non-user accounts. Ambiguous live ownership (missing/mismatched ledger claim or multiple claims for one profile) fails closed for manual review; repair does not guess an owner or silently enroll a profile.

## Authorization and audit

Database RPCs use `auth.uid()` plus existing `is_admin_or_above()` / `is_ceo()` helpers, including their banned/deleted-actor checks. All new privileged functions use an empty `search_path` and schema-qualified relations. Mutation RPCs grant execution only to authenticated callers; internal helpers revoke PUBLIC, anon and authenticated execution. RLS policies are unchanged.

The existing `moderation_actions` table stores `founding_removed`, `founding_repaired`, and `founding_finalized`. Removal records actor, target, previous number/claim, finalized state, reason, timestamp and renumbering mappings. Repair records the complete prior ledger, changed mappings, cleared deleted-profile numbers and final assigned count. Finalization records the locked ledger. The existing audit constraint now allows program-level repair/finalization entries without a target user; it does not grant new direct client insert permissions.

## UI and copy

`/admin/founding-500` uses the existing admin shell/navigation/card classes. It shows numbers, usernames/display names, profile type, joined/assigned dates, active/banned/retired/released status, profile links, counts and removal controls. `/admin/users` also shows Founding numbers and the removal action for administrators when state has loaded.

Removal asks for an optional reason and explicit confirmation covering the target/number, preserved account/type/content and open/finalized behavior. CEO repair/finalization live in a collapsed maintenance section and require both a confirmation and the exact typed phrase. Repair results show changed old → new mappings. Server actions revalidate public registry, management, user lists and profile/feed displays.

Public description, intro and retired-position copy now distinguish provisional open positions from permanently reserved finalized numbers. Organization-conversion warnings describe both policies. Old SQL test wording now describes ordinary direct-edit protection and retention *until explicit open repair*, rather than unconditional permanent reservation.

## Validation

Validation used the isolated Docker database `founding_maintenance_v2`, restored from local schema only (no copied user data) and brought forward through the repository's profile/badge and later migrations. The running development `postgres` database was not migrated. Schema-copy warnings concerned pre-existing schemas and default privileges owned by Supabase roles; application objects restored, and API-role behavior was exercised directly. The new migration applied successfully locally. Updated function definitions were tested locally during iteration.

Passed:

- All 18 SQL suites under `supabase/tests`, including Founding, admin, profile conversion, RLS/security, activity, notifications and vote access, pass in the isolated local database.
- New rollback-only maintenance suite covers first/middle/last removal, multiple shifts, unchanged earlier claims/types/content, badges, stale confirmations, non-founder denial, anonymous/ordinary/moderator/banned/deleted-actor denial, internal-helper/table denial, duplicates, injected audit failures, repair of gaps, timestamp-order inversion, audit snapshots, public ordering, finalization, deletion/conversion retirement and blocked reuse/reopening.
- `python scripts/test-founding-concurrency.py founding_maintenance_v2`: separate connections race signup against removal, repair and finalization. All three scenarios passed. The script requires an empty disposable database and uses local fixture teardown to reset finalization; that teardown is not an application capability.
- `npx vitest run`: 151 tests across 18 files, including new server-action, confirmation/visibility and public-policy copy tests.
- `npx tsc --noEmit`, `npm run lint`, `npm run build`, `git diff --check`.
- Supabase DB lint: no errors or warnings in the new functions. Existing `get_feed_ads` has shadowed/unused `slot` warnings.
- Supabase security advisors at error level: no issues.

### Final validation completed 2026-10-08

The two previously failing admin suites are fixed without changing database permissions:

- `moderation_tiering_role_changes.sql`: the fixture variable `post_id` was ambiguous with the conflict-target column. It is now `fixture_post_id`. Direct authenticated reads of `profiles` incorrectly assumed a SELECT grant; assertions now use the existing authorized `search_admin_users` RPC. A redundant direct role update was removed. The suite is transactionally rolled back.
- `admin_nav_counts.sql`: the same ambiguous fixture variable was renamed. Its anonymous EXECUTE-grant assertion was stale: baseline default privileges permit invocation, while the function rejects unauthenticated callers. The test now requires either permission denial or the exact authentication error, and never accepts returned data. The suite is transactionally rolled back.
- The complete run also exposed stale grant/RLS assumptions in `user_activity_overview.sql`. Tests now exercise forbidden anonymous calls and inspect persistence as the test owner after authenticated RPC writes; no client SELECT policy or grant was added. Fixtures roll back.

Authenticated browser testing found one implementation defect that direct SQL did not expose: PostgREST's safeupdate protection rejected repair's DELETE without a WHERE clause. The pending migration now deletes ledger rows with the explicit bounded predicate `number between 1 and 500`. The existing range constraint makes this the same intended operation. Safeupdate, RLS, grants and authorization remain intact. Both isolated databases received the corrected function for validation.

`playwright.founding.config.js` and `tests/e2e/founding-maintenance.local.spec.js` provide an opt-in local test. The successful run passed one comprehensive test with five workflow steps (13.5 seconds total), using real local GoTrue login and PostgREST calls against a separate `tf_founding_validation` Docker stack on API port 55321. Schema and badge definitions were copied locally; real user data was not copied. Fixtures are guarded to run only against that disposable stack.

Browser assertions passed for:

- Authorized admin page loading, correct member numbers, ordinary/moderator denial, and no removal action for non-founders.
- Removal cancellation with unchanged database/audit state, optional reason persistence, removal/resequencing with updated UI, and preservation of profile type, account and content.
- CEO-only repair after Organization conversion, rejected incorrect typed confirmation, successful numeric compaction, old-to-new mappings and audit snapshot.
- Finalization cancellation and incorrect typed confirmation with no effects, successful explicit finalization, and removal of repair/finalization controls.
- Finalized removal with an empty reason, retained retired number, unchanged later member number, and correct public finalized copy. Fresh browser contexts reported no page errors.

Screenshots are local ignored artifacts under `test-results/founding-maintenance.local-7a351-ion-through-persisted-state/` (`admin-founders.png`, `ceo-repair-result.png`, `finalized-public-registry.png`). Browser runs require `FOUNDING_LOCAL_E2E=1`, `FOUNDING_LOCAL_SUPABASE_URL=http://127.0.0.1:55321`, and the isolated stack's server-side key in `FOUNDING_LOCAL_SERVICE_KEY`, with the local Next server on port 3105 configured for that stack. Run `npx playwright test --config playwright.founding.config.js`. No credentials are committed or logged; traces are disabled.

Final results: 18/18 SQL suites, all three concurrency scenarios, 151 JavaScript tests across 18 files, TypeScript, ESLint, production build, and error-level security advisors passed. Database lint has only the existing unrelated `get_feed_ads` shadowed/unused `slot` warnings. Package manifests and generated route typings have no changes. The pre-existing root `proxy.js` deletion and `src/app-links.test.js` edits were preserved.

The pending migration is ready for controlled production application subject to prerequisite migrations and normal backup/review procedures. Production schema/data parity was not inspected. Validation used isolated schema-based databases rather than a clean replay of the entire legacy migration history; historical seed-dependent migrations prevent that bootstrap path. No deployment, remote migration, or production mutation was performed.

No further policy approval is needed for the local implementation. Deployment remains separate. Existing gaps require an intentional CEO repair after a future migration deployment; applying this migration alone never performs that repair or finalizes the program.
