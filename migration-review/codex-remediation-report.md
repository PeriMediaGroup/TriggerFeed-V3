# Codex Migration Remediation Report

## Executive summary

Changed the TriggerFeed V3 web repository to make production database cutover preparation safer and more reviewable. The work added shared PowerShell safety helpers, hardened all requested remote import scripts, removed a tracked local credential comment, removed two sensitive local files from Git tracking without deleting them, fixed the `get_admin_nav_counts` lint issue with a forward migration, added verification/reporting tooling, and created cutover documentation.

Current recommendation: not ready for production cutover yet. The repository is ready for another independent review, but launch should wait for credential rotation, Git history review/cleanup decisions, approved expected counts, approved test-account exclusions, and operator sign-off.

No production Supabase project, legacy production database, remote import script, or remote migration was contacted.

## Files changed

- `.gitignore`
  - Purpose: keep private/env/review artifacts controlled while allowing reviewable migration scripts.
  - Key changes: added exceptions for `scripts/migration/*.ps1`, ignored `scripts/migration/*.private.ps1`, ignored `.env*.backup`, and allowed the remediation report path.
  - Risk level: low.

- `.env.online.backup`
  - Purpose: environment backup file.
  - Key changes: removed from Git tracking only; local file remains on disk and is ignored.
  - Risk level: high if previously committed with real values.

- `scripts/migration/run-local-migration.private.ps1`
  - Purpose: private local migration helper.
  - Key changes: removed from Git tracking only; local file remains on disk and is ignored.
  - Risk level: high if Git history contains credentials.

- `scripts/migration/lib/MigrationSafety.psm1`
  - Purpose: shared PowerShell validation and redacted logging helpers.
  - Key changes: required env-var validation, localhost target rejection, redacted DB labels, command checks, native command exit handling, and explicit production confirmation.
  - Risk level: low.

- `scripts/migration/import-current-users-remote.ps1`
- `scripts/migration/import-current-posts-remote.ps1`
- `scripts/migration/import-current-comments-remote.ps1`
- `scripts/migration/import-current-friends-remote.ps1`
- `scripts/migration/import-current-votes-remote.ps1`
  - Purpose: remote import stages.
  - Key changes: require `OLD_TRIGGERFEED_DB_URL` and `TRIGGERFEED_V3_DB_URL`, reject local targets, remove localhost defaults, never print full URLs, add `-DryRun`, require `-ConfirmProductionImport` for execution, and preserve existing import SQL.
  - Risk level: medium because these scripts can write production data when explicitly confirmed.

- `scripts/migration/import-current-users-local.ps1`
  - Purpose: local user import.
  - Key changes: replaced a concrete legacy database URL in a comment with a placeholder.
  - Risk level: low after edit; high historically if committed.

- `supabase/migrations/20260716120000_remove_obsolete_moderation_reviews_nav_count.sql`
  - Purpose: forward migration to resolve admin nav lint error.
  - Key changes: replaces `get_admin_nav_counts()` without referencing nonexistent `public.moderation_reviews`; preserves reports, abuse report, reviews, roleReviews, and total JSON keys.
  - Risk level: low to medium.

- `scripts/migration/review-test-accounts.sql`
- `scripts/migration/export-test-account-review.ps1`
- `scripts/migration/test-account-exclusions.example.csv`
  - Purpose: reviewable test-account candidate reporting.
  - Key changes: flags candidates with reasons and confidence, exports CSV, includes blank manual decision fields, and does not delete or exclude accounts.
  - Risk level: low.

- `scripts/migration/production-verify.sql`
- `scripts/migration/verify-production-import.ps1`
- `scripts/migration/expected-counts.example.json`
  - Purpose: production verification and reconciliation.
  - Key changes: emits PASS/WARN/FAIL checks, writes timestamped CSV reports, returns nonzero on FAIL, supports local rehearsal, supports expected-count JSON, and avoids exact production count assumptions.
  - Risk level: medium; should be independently reviewed before launch-day reliance.

- `docs/production-database-cutover.md`
- `docs/launch-day-runbook.md`
  - Purpose: operator cutover and launch-day documentation.
  - Key changes: added checklists for backups, restore proof, import order, verification, smoke tests, go/no-go, rollback, monitoring, staging cleanup, and evidence retention.
  - Risk level: low.

## Validation performed

- `npx supabase db lint`
  - Initial result: failed locally because `public.get_admin_nav_counts` still referenced `public.moderation_reviews`.
  - Follow-up: `npx supabase migration up` applied only the new local forward migration.
  - Final result: passed with `{"results":[],"message":"db lint"}` and `No schema errors found`.

- PowerShell parse validation
  - Command: parsed all `scripts/migration/**/*.ps1` and `scripts/migration/**/*.psm1` with `System.Management.Automation.PSParser`.
  - Result: passed for 14 files.

- Remote import validation paths
  - Missing env vars: users remote script failed before any DB connection.
  - Localhost target: posts remote script rejected `127.0.0.1` target before any DB connection.
  - Missing confirmation: comments remote script refused execution without `-ConfirmProductionImport`.
  - Dry run: all five requested remote scripts passed `-DryRun` with fake non-local placeholder hosts and attempted no DB connections.

- Verification tooling
  - Command: `verify-production-import.ps1` against local DB with `-LocalRehearsal`.
  - Result: passed; wrote timestamped CSV report; no FAIL/WARN rows on current local state.
  - Command: same with `-ExpectedCountsPath .\scripts\migration\expected-counts.example.json`.
  - Result: passed with empty expected-count template.

- Test-account export
  - Command: `export-test-account-review.ps1` against local DB.
  - Result: passed; wrote timestamped candidate CSV.

- `git diff --check`
  - Result: passed. Git printed Windows line-ending warnings only.

- Skipped
  - Clean `supabase db reset`: skipped because local disposable status was not established and reset could destroy local data.
  - Any remote migration/import/database command: skipped by restriction.

## Security findings

- Current tracked-secret scan result:
  - No tracked concrete database URL remained in the reviewed remote scripts after remediation.
  - `.env.online.backup` was tracked and contained possible real environment values. It was removed from the Git index only and is now ignored.
  - `scripts/migration/run-local-migration.private.ps1` was tracked. It was removed from the Git index only and is now ignored.
  - `scripts/migration/import-current-users-local.ps1` had a concrete legacy database URL in a comment. The comment now uses a placeholder.
  - Broad-pattern scan still flags placeholders, local defaults, role names such as `service_role`, and code variable names. These should be reviewed independently, but values were not reproduced in this report.

- Git history warning:
  - Removed files and the old local-script comment may still exist in Git history. Do not rewrite history without owner approval and coordination.

- Credential rotation reminder:
  - Rotate any credential that was ever committed, pasted into logs, shared in screenshots, or stored in tracked files, even if the current tree no longer contains it.

## Production blockers

- Independent review of all migration scripts, SQL, and docs is still required.
- Credential rotation decision and evidence are required.
- Git history cleanup decision is required if exposed credentials were committed.
- Expected counts must be filled from real retained legacy counts, approved exclusions, and documented invalid records.
- Test-account exclusions must be manually approved by explicit user UUIDs.
- Backup creation and restore proof must be completed.
- Launch-day operator approvals and application smoke tests remain outstanding.

## Manual actions required

1. Review this diff independently.
2. Rotate exposed or possibly exposed credentials.
3. Decide whether Git history cleanup is required.
4. Prepare the real expected-count JSON.
5. Export and manually review test-account candidates.
6. Create an approved exclusions CSV using explicit user UUIDs only.
7. Rehearse verification locally or in an approved staging environment.
8. Complete backup and restore proof.
9. Run launch-day checklist with operator and approver sign-off.
