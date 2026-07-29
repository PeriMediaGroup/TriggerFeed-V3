# TriggerFeed V3 Migration Review

Repository: `C:\Users\petes\PeriMediaGroup\TriggerFeed_V3\web`

Review type: audit only. No source code, migrations, scripts, or database state were modified.

## Executive summary

Current migration materials are not production-ready without remediation. The schema migration chain is broadly organized and includes later hardening work, but the import/runbook surface has blockers around secrets hygiene and remote import script correctness.

## Go/no-go assessment

No-go until these are fixed or explicitly accepted by the owner:

1. `scripts/migration/import-current-users-local.ps1` contains a concrete legacy database connection string with a password in a comment. The value is intentionally not reproduced here. This file was excluded from the review archive.
2. `scripts/migration/import-current-posts-remote.ps1`, `scripts/migration/import-current-comments-remote.ps1`, and `scripts/migration/import-current-votes-remote.ps1` are named as remote scripts but still target the local default database URL.
3. `scripts/migration/import-current-users-remote.ps1` prints the target DB connection string to terminal output. That can leak credentials into terminal history, CI logs, or screen recordings.
4. The import process is not atomic end to end. Recovery from partial failure depends on manual interpretation and reruns.
5. `npx supabase db lint` reported an issue in `public.get_admin_nav_counts`: dynamic SQL references `public.moderation_reviews`, which does not exist in the current migration chain. The function attempts to guard with `to_regclass`, but the linter still reports SQLSTATE `42P01`.

## Positive observations

- `supabase/config.toml` has migrations enabled and seed disabled.
- `.env.example` contains placeholders only in this audit.
- Database-related Edge Function `report-abuse` reads the service role key from runtime environment and does not commit a key.
- Later migrations harden helper function execute grants.
- Moderation role helpers and admin restrictions are represented in the migration chain, including admin/CEO user-search restriction and tiered role-change migration.

## Main risks

- Secret handling: one committed script comment contains a real credential and must be removed from git history or rotated before production use.
- Operator confusion: three `*-remote.ps1` scripts target local DB by default, making a production cutover runbook unsafe.
- Validation gaps: import scripts print counts, but the go/no-go thresholds are not encoded consistently as hard failures.
- Rollback gap: no dedicated rollback scripts exist. Production rollback depends on tested backup/restore procedures.
- Optional-relation lint finding: `get_admin_nav_counts` references a relation that is absent from the current schema state.

## Recommended production order

1. Rotate any credential exposed by committed scripts or logs.
2. Fix or retire misleading remote import scripts.
3. Remove connection-string printing from remote scripts.
4. Add explicit hard-fail checks for accepted orphan/drop counts.
5. Rehearse full import into a disposable remote-like Supabase project.
6. Capture before/after row counts and sampled UI/API smoke tests.
7. Confirm rollback restore time and owner approval before final cutover.

## Archive notes

Created archive: `triggerfeed-migration-review.zip`

The archive intentionally includes only review docs and requested database/migration-related inputs. It intentionally excludes `.env`, `.env.local`, `node_modules`, `.next`, `.git`, `supabase/.temp`, dumps, media, API keys, service-role keys, and the secret-bearing `scripts/migration/import-current-users-local.ps1` file.

## Validation performed during audit

- `npx supabase db lint` was run from the web repo. The process exited `0`, but the JSON result reported one error-level issue: `public.get_admin_nav_counts` references missing relation `public.moderation_reviews` inside dynamic SQL. Treat this as unresolved until reviewed or fixed.
- No database reset, migration, or data import was run.
