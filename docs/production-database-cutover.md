# TriggerFeed V3 Production Database Cutover

This runbook is for production preparation and launch execution. Use placeholders for secrets in notes and tickets; never paste database URLs, passwords, service-role keys, or access tokens into this document.

## Preparation Checklist

- [ ] Confirm all migration scripts and SQL have independent review.
- [ ] Confirm no production or legacy database connection is attempted before approved cutover.
- [ ] Rotate any credential that was ever present in tracked files, command logs, screenshots, or shared notes.
- [ ] Review Git history for removed private migration material. If a real credential was committed historically, rotate it even if the file is now ignored or untracked.
- [ ] Confirm current `.gitignore` keeps dumps, private scripts, env files, and review outputs out of accidental commits unless explicitly allowed.
- [ ] Confirm `migration-dumps/` and backup paths are excluded from Git.
- [ ] Prepare `scripts/migration/test-account-exclusions.example.csv` as a real approved exclusions file using explicit user UUIDs only.
- [ ] Prepare `scripts/migration/expected-counts.example.json` as a real expected-count file. Do not invent counts.

## Write Freeze And Backups

- [ ] Announce legacy write freeze.
- [ ] Put the legacy app into the agreed read-only or maintenance state.
- [ ] Confirm no background jobs can write to the legacy database.
- [ ] Take final legacy backup and record backup artifact path, timestamp, operator, and verification result.
- [ ] Take V3 pre-reset backup and record backup artifact path, timestamp, operator, and verification result.
- [ ] Restore each backup into a disposable environment and prove it can be queried.

## Migration Application

- [ ] Confirm target V3 project URL placeholder: `<v3-project-url>`.
- [ ] Confirm target V3 database host placeholder: `<v3-database-host>`.
- [ ] Confirm legacy database host placeholder: `<legacy-database-host>`.
- [ ] Apply reviewed V3 migrations through the approved Supabase workflow.
- [ ] Do not run remote import scripts unless the operator has explicitly approved production import and supplied required env vars.
- [ ] Import order:
  1. Users/auth/profiles
  2. Posts/media
  3. Comments
  4. Friends
  5. Votes
- [ ] Retain staging tables until verification and rollback windows are complete.

## Test-Account Review

- [ ] Export candidate report:

```powershell
$env:TRIGGERFEED_V3_DB_URL = "postgresql://<v3-user>:<v3-password>@<v3-host>:5432/<v3-database>"
.\scripts\migration\export-test-account-review.ps1
```

- [ ] Review candidates manually.
- [ ] Approve exclusions by explicit user UUID only.
- [ ] Do not exclude accounts through fuzzy matching.
- [ ] Do not delete accounts as part of this report.

## Verification Commands

Dry-run each remote import script before production import:

```powershell
$env:OLD_TRIGGERFEED_DB_URL = "postgresql://<legacy-user>:<legacy-password>@<legacy-host>:5432/<legacy-database>"
$env:TRIGGERFEED_V3_DB_URL = "postgresql://<v3-user>:<v3-password>@<v3-host>:5432/<v3-database>"
.\scripts\migration\import-current-users-remote.ps1 -DryRun
.\scripts\migration\import-current-posts-remote.ps1 -DryRun
.\scripts\migration\import-current-comments-remote.ps1 -DryRun
.\scripts\migration\import-current-friends-remote.ps1 -DryRun
.\scripts\migration\import-current-votes-remote.ps1 -DryRun
```

Run verification after imports:

```powershell
$env:TRIGGERFEED_V3_DB_URL = "postgresql://<v3-user>:<v3-password>@<v3-host>:5432/<v3-database>"
.\scripts\migration\verify-production-import.ps1 -ExpectedCountsPath .\scripts\migration\expected-counts.json
```

## Smoke Tests

- [ ] Log in with approved test/operator accounts.
- [ ] Verify feed loads.
- [ ] Verify profile page loads.
- [ ] Verify post detail loads.
- [ ] Verify create post works.
- [ ] Verify comments work.
- [ ] Verify vote buttons work.
- [ ] Verify friends page and requests work.
- [ ] Verify notifications load.
- [ ] Verify admin reports page loads for moderator/admin/CEO as appropriate.
- [ ] Verify `/admin/users` is inaccessible to moderators and accessible to admin/CEO only.

## Go/No-Go

Go only when:

- [ ] No verification FAIL rows remain.
- [ ] WARN rows are reviewed and explicitly accepted.
- [ ] Expected count variances are documented.
- [ ] Backups and restore proof are complete.
- [ ] Smoke tests pass.
- [ ] Owner or delegated approver signs off.

No-go triggers:

- Any unexplained verification FAIL.
- Missing or unproven backup.
- Unrotated exposed credential.
- Unreviewed account exclusions.
- Broken login, feed, posting, comments, votes, friends, notifications, or admin moderation.

## Rollback

- [ ] Freeze V3 writes.
- [ ] Capture V3 incident-state backup.
- [ ] Restore the last known-good production database or re-point application configuration according to the approved rollback plan.
- [ ] Re-enable legacy production only after data ownership and write divergence are reviewed.
- [ ] Record rollback operator, start time, end time, command/result, and approval.

## Post-Launch

- [ ] Monitor auth errors, app errors, Supabase logs, and user reports.
- [ ] Keep verification reports, import logs, backups, expected-count files, and approved exclusions per evidence retention policy.
- [ ] Decide when to archive or remove migration staging tables.
- [ ] Rotate temporary cutover credentials.
- [ ] Schedule a retrospective review of WARN rows and accepted variances.
