# Test Account Review

## Current state

- `supabase/config.toml` has `[db.seed].enabled = false`.
- `supabase/config.toml` still references `./snippets/set up test accounts.sql` in `sql_paths`.
- No `supabase/seed.sql` file was present during this audit.

## Production guidance

- Keep seed disabled for production.
- Do not run test-account snippets against production.
- Confirm no test users are inserted by migrations.
- If test accounts are needed for smoke testing, create them through an approved production-safe path and remove or disable them before launch unless they are formal internal accounts.

## Account classes to verify

- Anonymous visitor
- Normal authenticated user
- Muted or restricted user, if present
- Moderator
- Admin
- CEO

## Role and permission checks

- Moderator can access moderation flows that are intentionally moderator-level.
- Moderator cannot access admin/CEO-only account-management flows.
- Admin can access admin account-management flows where intended.
- CEO-only role changes require CEO and audit reason.
- Suspended, banned, or soft-deleted accounts cannot perform blocked interactions.

## Data checks

- Migrated users have matching `auth.users` and `public.profiles` rows.
- Migrated profiles have expected usernames/display names.
- Protected profile fields are not exposed through public RPCs.
- Public profile card hydration works without direct unsafe profile reads.
