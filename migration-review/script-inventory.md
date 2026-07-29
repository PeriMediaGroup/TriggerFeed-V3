# Script Inventory

Scope: `scripts/migration/` in the web repository. This is an audit document; no scripts were modified.

## Summary table

| Script | Intended surface | Target behavior observed | Production readiness |
| --- | --- | --- | --- |
| `import-current-users-local.ps1` | Local auth/profile import | Imports auth users/identities and profiles into local DB. | **Do not package or run as-is.** Contains a concrete legacy DB URL with password in a comment. |
| `import-current-users-remote.ps1` | Remote auth/profile import | Uses `TRIGGERFEED_V3_DB_URL`, rejects localhost target, imports `auth.users`, `auth.identities`, and profiles. | Needs log sanitization before production because it prints the target DB URL. |
| `import-current-posts-local.ps1` | Local posts/media import | Uses local V3 DB target and old DB source. Converts legacy media URL fields into `post_media`. | Local rehearsal only. |
| `import-current-posts-remote.ps1` | Named remote posts/media import | Still declares and uses `LocalDbUrl` with default `127.0.0.1:54322`; no remote target guard. | **Blocker.** Name implies remote, behavior targets local. |
| `import-current-comments-local.ps1` | Local comments import | Uses local V3 DB target and old DB source. Converts comment image URLs into body text. | Local rehearsal only. |
| `import-current-comments-remote.ps1` | Named remote comments import | Still declares and uses `LocalDbUrl` with default `127.0.0.1:54322`; no remote target guard. | **Blocker.** Name implies remote, behavior targets local. |
| `import-current-friends-local.ps1` | Local friends import | Uses local V3 DB target and old DB source. Normalizes friend pairs. | Local rehearsal only. |
| `import-current-friends-remote.ps1` | Remote friends import | Uses `TRIGGERFEED_V3_DB_URL`, rejects localhost target, stages and inserts friend rows. | Closer to production-ready; still needs dry-run/runbook proof and drop-count reporting. |
| `import-current-votes-local.ps1` | Local votes import | Uses local V3 DB target and old DB source. Filters vote values to `-1` and `1`. | Local rehearsal only. |
| `import-current-votes-remote.ps1` | Named remote votes import | Still declares and uses `LocalDbUrl` with default `127.0.0.1:54322`; no remote target guard. | **Blocker.** Name implies remote, behavior targets local. |
| `run-local-migration.private.ps1` | Local orchestration | Runs local reset and local import scripts. | Local-only. Do not use for production. |

## Import coverage

Covered by scripts:

- Auth users and identities
- Public profiles
- Posts
- Legacy post image/GIF/video URL fields converted into `post_media`
- Comments
- Friend relationships
- Post votes

Not covered by current scripts:

- Legacy notifications
- Legacy private messages, if any
- Legacy polls/poll responses, despite V3 poll schema existing
- Any legacy data outside the explicit script queries

## Transaction and idempotency observations

- Scripts generally stage legacy data in `public.migration_old_*` tables, delete known migrated rows, then insert/upsert replacement data.
- The overall import process is not atomic across export, staging, delete, insert, and verification phases.
- Partial failure recovery depends on rerunning specific scripts and interpreting staging/validation output.
- Staging tables remain in `public` unless manually cleaned up later. Decide before cutover whether to preserve them for audit or drop/archive them after validation.

## Data-loss/drop-count risks

- Several inserts join staged rows to existing V3 users/posts. Unmatched rows can be skipped by joins; validation reports should be made explicit enough to approve or reject every dropped row count.
- Posts script hard-fails when profile count is zero and when staged post count is zero. It reports orphan posts and media breakdowns.
- Comments, friends, and votes scripts report validation counts, but production runbook should require exact accepted thresholds before proceeding.

## Archive exclusion

- `scripts/migration/import-current-users-local.ps1` is intentionally excluded from `triggerfeed-migration-review.zip` because it contains a real legacy connection string with a password in a comment. The secret value is intentionally not reproduced in this review.
