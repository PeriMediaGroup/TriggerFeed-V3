# Admin profile type conversion and Founding 500

Implemented in `/web` only. No remote migration, production account change, push, or commit was performed.

## Root cause

`update_profile_type_and_metadata()` explicitly rejected organization conversion for founders. The profile assignment trigger made numbers immutable, the Founding badge trigger only added badges, and the allocator selected `max(number) + 1`, so removing a claim alone would not make a lower number reusable. The admin editor also reused the CEO-only role-management permission and its search RPC did not return the account classification or Founding number needed for restrictions and warnings.

## Migration

`supabase/migrations/20260922221050_profile_type_founding_transitions.sql`

Created using `supabase migration new profile_type_founding_transitions --workdir .`.

- Adds nullable `released_at` to the existing `founding_member_numbers` ledger. Released rows have no owner. Existing rows remain unchanged and retain their prior claim/retirement semantics.
- Reuses the existing Founding advisory transaction lock for release and allocation. The profile RPC locks its target row before changing type.
- Allows only an authenticated, active admin/CEO organization conversion to release an assigned number. A mismatched ledger fails closed; arbitrary clearing or renumbering remains forbidden.
- Updates the existing badge synchronization trigger to delete the Founding badge when the number is released. Other badge logic, including the existing type-change verification invalidation, is unchanged.
- The normal allocator prefers the lowest explicitly released number, then continues its existing highest-number-plus-one sequence. Deleted-profile claims and other historical reservations are not reopened. Manual requested-number claims can also reuse explicit releases.
- Public registry output excludes released slots until they are claimed again. Released ledger rows are availability state, not stale claims or retired public entries.
- Adds account_type, profile_type, and founding_member_number to the existing admin-only search RPC.
- Explicitly removes anon/authenticated execution grants from internal allocation/trigger functions. The public conversion RPC retains authenticated execution and checks admin/CEO authorization in the database.
- Applying the migration does not convert, renumber, release, or delete any existing assignment.

## Conversion behavior

| Transition | Result |
| --- | --- |
| Member to Creator | Keeps current number and Founding badge/claim. |
| Creator to Member | Keeps current number and Founding badge/claim. |
| Member or Creator to Organization | Clears the profile number, releases the ledger claim, and removes the Founding badge in the same transaction as metadata. |
| Organization to Member or Creator | Runs the normal allocator only when auto-assignment is enabled and the profile passes existing eligibility/internal-domain rules. No number is specially restored. |
| Organization back to an eligible type with allocation disabled/full | Conversion succeeds with no Founding number. |
| System, editorial, bot accounts or system profiles | Cannot be converted through this editor/RPC. System is not an available destination. |
| Non-admin, moderator, banned/deleted administrator | Cannot perform conversion. |

A returning organization can receive its old number only if the ordinary allocator chooses that available slot; the prior owner has no restoration preference. Both @triggerfeed.com and @perimediagroup.com remain excluded. Roles, account_type, auth flows, and signup behavior are not changed.

## Admin UI and application files

- `src/features/admin/components/AdminUserCard.jsx`: Member/Creator/Organization controls and a confirmation containing the actual number, for example `Changing this profile to Organization will release Founding Member #24.` Cancel performs no save. Member/Creator swaps have no release warning.
- `src/features/admin/permissions.js`: separate admin/CEO profile-type permission; role management remains CEO-only.
- `src/features/admin/profileTypeTransitions.js`: editable-type, protected-profile, and warning helpers.
- `src/features/admin/actions/moderationActions.js`: rejects System as a conversion destination.
- `src/features/admin/data/getAdminUsers.js`: treats the admin RPC classification as authoritative.
- `src/features/admin/profileTypeTransitions.test.js`: warning and permission tests.
- `src/features/admin/components/AdminUserCard.test.jsx`: component interaction tests, including actual confirmation and save/cancel behavior.
- `supabase/tests/profile_type_founding_transitions.sql`: new rollback-only database suite.
- `docs/profile-type-founding-transitions.md`: this report.

## Validation

All commands ran from `/web`. Migration/functions were exercised only in local Docker database `tf_creator_v1_validation`.

Passed database suites:

- `supabase/tests/profile_type_founding_transitions.sql`
- `supabase/tests/founding_500.sql`
- `supabase/tests/founding_500_internal_domains.sql`
- `supabase/tests/creator_organization_v1.sql`

The new suite uses actual anon/authenticated roles and covers admin and CEO transitions, claim/badge preservation and release, public registry state, signup reuse, manual reuse, automatic assignment on both return transitions, both internal domains, protected account types, ordinary-user/moderator denial, banned/deleted administrators, deleted targets, immutable-number safeguards, mismatched claims, disabled auto-assignment, 500-cap exhaustion/reuse, and rollback of both release and allocation when metadata validation fails.

Also passed:

- Local Supabase public-schema lint: no error findings.
- Local security advisors at error level: no error-level findings.
- `npm run lint`.
- `npx tsc --noEmit`.
- `npm run build` (including Next.js TypeScript check).
- `npx vitest run`: 92 tests, eight files.
- `git diff --check`.

## Deferred

Remote migration/deployment and the real TF-One-to-SmithSightsLLC browser conversion are intentionally not performed. SmithSightsLLC is not hard-coded or modified. Tests cover the database transaction and component interaction separately; a production end-to-end browser walkthrough remains unverified. No mobile changes were needed.
