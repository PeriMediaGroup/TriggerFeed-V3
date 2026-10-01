# Anonymous friend-discovery permission review

Reviewed and validated locally on 2026-10-01. No remote database changes.

## Finding and intended contract

The original failing assertion in `supabase/tests/search_friend_candidates.sql` was
`anonymous role should not be able to execute friend search`.
It correctly identified an unnecessary explicit `anon` EXECUTE grant. Supabase's
local function default ACL grants EXECUTE to `anon`, `authenticated`, and
`service_role`. Historical discovery migrations revoked `PUBLIC`, but that does
not revoke a separate grant to `anon`. The Founding 500 migration recreates search
and retains this pattern. The existing test also had a separate stale result-key
expectation: it omitted the legitimate `founding_member_number` field.

This was excess permission, not evidence that anonymous callers obtained private
friend data: search already raises `Authentication required` without `auth.uid()`;
suggestions return no rows; the relationship helper returns false. Those defenses
remain. The new migration rejects anonymous invocation at the permission boundary.

Web's friend dashboard requires a user, its suggestions loader skips guests, and
Android People/Friends discovery runs inside the authenticated experience. Neither
has an established anonymous discovery use case. In contrast, Web's public profile
route intentionally uses public detail/cards/badges and aggregate friend counts.
Those public projections remain accessible; raw relationships and request lists do
not become public merely because a profile is public.

## RPC audit

The eight functions below were inspected in the local database and migration
history. All are SECURITY DEFINER, owned by postgres, with `search_path=public`
before this change. They execute with owner privileges; their explicit predicates,
rather than caller RLS alone, enforce the projected data contract.

Before: each had EXECUTE for `anon`, `authenticated`, and `service_role`, and no
EXECUTE for the pseudo-role `PUBLIC`. After: only the first three lose `anon`;
authenticated/service grants remain, and PUBLIC remains denied.

| Signature | UID/data boundary | After search path |
| --- | --- | --- |
| `search_friend_candidates(text,integer)` | Rejects null UID; excludes self/deleted/banned/non-user candidates; privacy-gated location and viewer's relationship state | empty |
| `get_friend_suggestions(integer)` | Viewer must match UID and be a live, unbanned user; excludes existing relationships and muted/deleted/banned/non-user candidates; returns mutual count and ranking reason | empty |
| `are_users_accepted_friends(uuid,uuid)` | Non-null UID must be one of the supplied pair; tests accepted relationship | empty |
| `get_public_profile(uuid)` | No authentication requirement; excludes deleted profiles and projects privacy-controlled detail fields | public, unchanged |
| `get_public_profile_cards(uuid[])` | No authentication requirement; excludes deleted profiles and gates real name/location by privacy settings | public, unchanged |
| `get_public_profile_badges(uuid[])` | No authentication requirement; public badge projection | public, unchanged |
| `get_profile_friend_count(uuid)` | No authentication requirement; aggregate accepted count only for a visible profile | public, unchanged |
| `is_profile_visible(uuid)` | No authentication requirement; checks non-deleted profile existence | public, unchanged |

`get_public_profile_metadata(uuid[])` was additionally reviewed in migration
`20260915091753_profile_types_metadata_verified_badge.sql`: SECURITY DEFINER,
`search_path=public`, no UID requirement, explicit anon/authenticated grants and
PUBLIC revocation. It projects explicitly public Creator/Organization metadata,
excluding deleted profiles. It is absent from this local database, so its runtime
ACL/service-role grant and compatibility could not be verified. The test emits an
explicit skip for that optional check when the RPC is absent; it checks it when
installed. This migration does not change it.

The touched function bodies already qualify application relations/helpers with
`public` and authentication with `auth`. An empty search path removes writable
schema resolution while PostgreSQL still resolves built-ins through pg_catalog.
Bodies, owners, signatures and argument names are unchanged.

## Tables and callers

`friends` has no anonymous SELECT grant; its authenticated SELECT policy permits
only the requester or addressee. This covers accepted relationships and incoming/
outgoing pending requests. Inserts require the requester to be the current user,
pending status, a different recipient, and the existing interaction restriction
check. Existing acceptance/deletion rules are unchanged.

Profiles have public visibility policies but restricted anonymous column grants.
Direct reads of email/privacy settings are denied; public RPC projections control
private fields. No table grant or RLS policy was changed.

Web uses the existing FriendsPanel/search RPC and authenticated dashboard loaders.
Android uses the same named search/suggestions arguments, public card/badge
hydration, and participant-scoped `friends` reads. No Web or Android client changes
were needed. Public profile aggregate counts and curated showcases remain public.

## Changes and verification

- Added `supabase/migrations/20261001133415_restrict_anonymous_friend_discovery.sql`:
  revoke anon/PUBLIC on the three member-only functions; retain authenticated and
  existing system access; pin their search paths to empty.
- Updated `supabase/tests/search_friend_candidates.sql`: correct the Founding 500
  result shape, wrap fixtures in a rollback transaction, assert anonymous RPC/table/
  private-column denial, public projections, authenticated named arguments,
  relationship status, blocked/muted candidates, banned/deleted viewers, explicit
  ACLs and definer/search-path configuration. Original privacy, ranking and limit
  checks remain.

Local results:

| Check | Result |
| --- | --- |
| Full `search_friend_candidates.sql` | Passed; public metadata subcheck explicitly skipped because RPC is absent |
| `notification_settings_enforcement.sql` (includes friend request/accept notifications) | Passed |
| `reply_notification_relationship.sql` | Passed |
| `privacy_rls_audit.sql` | Passed |
| `beta_hardening.sql` moderation/restriction checks | Passed |
| `supabase db lint --local` | No schema errors; empty findings array |
| Web `vitest run` | 132 tests, 14 files passed |
| Android `node --test --test-reporter=dot tests/search-friends.test.cjs` | 20 passed |
| `git diff --check` | Passed |

The migration was applied only to the existing local Docker database. SQL fixtures
were rolled back. Production permissions and a clean full migration replay were
not verified. Existing unrelated Web/Android work was preserved.

## Additional findings left unchanged

- Authenticated suggestions use raw state for the `Also in your state` reason,
  even when location display is private. Search matches first/last names even when
  those fields are hidden in the returned projection. These create potential
  inference paths for authenticated users and merit a separate product/privacy
  decision; this grant change does not resolve them.
- Suggestion recent activity includes comments without checking their parent
  post's visibility. The output is an activity reason/rank, not comment contents,
  but it can expose activity on non-public posts.
- Search requires a UID but does not gate the viewer's moderation status as
  suggestions do. Search retains blocked results with `blocked` relationship state;
  suggestions exclude them. These existing differences were not normalized.
- Friend insertion validates requester restrictions, but the inspected policy
  does not independently validate recipient eligibility. This pre-existing Android
  review finding is outside anonymous-discovery permissions.
- Global default function grants remain broad. Future migrations recreating
  member-only functions must explicitly revoke `anon`, not only `PUBLIC`.
- Missing local public metadata RPC is schema drift, not caused by this migration;
  its runtime compatibility remains unverified here.
