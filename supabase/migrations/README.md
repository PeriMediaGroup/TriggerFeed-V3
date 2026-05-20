# TriggerFeed V3 Consolidated Supabase Migrations

This folder replaces the previous 010-112 migration chain for a pre-live/dev database.

## Naming

Files use spaced numbering (`010`, `020`, `030`, etc.) so future migrations can be inserted without goofy names like `003_final_really.sql`.

## Important workflow

Use this consolidation only before production/live users exist.

After live:
- Do not edit old migrations.
- Add new forward-only migrations.

Before live:
- It is acceptable to edit these consolidated migrations and reset the local DB.

## Replace current migrations

From the repo root on Windows PowerShell:

```powershell
mkdir supabase\migrations_old
copy supabase\migrations\*.sql supabase\migrations_old\
Remove-Item supabase\migrations\*.sql
copy path\to\consolidated_migrations\*.sql supabase\migrations\
```

Then:

```powershell
npx supabase db reset
npm run lint
npm run build
npm run dev
```

## Required app follow-ups

These migrations intentionally avoid granting broad profile `role` access.

Required app changes:

1. `src/features/profiles/data/getProfileById.js`
   - Do not select `email`, `role`, `is_banned`, `is_muted`, or `is_deleted`.
   - Public profile reads should use public-safe profile fields only.

2. `src/features/profiles/data/getCurrentProfile.js`
   - Do not rely on direct `profiles.role` select unless you intentionally loosen the grants.
   - Use `get_my_profile_auth_status()` for current user's role/banned/deleted state.

3. `src/features/mentions/actions/createMentionNotifications.js`
   - Call `create_mention_notification` with:
     - `p_user_id`
     - `p_post_id`
     - `p_comment_id`
   - Do not pass actor id. The RPC derives actor from `auth.uid()`.

4. `src/features/profiles/data/getProfileStats.js`
   - Use `get_profile_friend_count(target_user_id)` instead of directly counting raw `friends` rows.

## Security posture

- Public profile reads do not expose email.
- Normal users cannot directly update `role`, `profile_badge`, `is_banned`, `is_muted`, `is_deleted`, or `email`.
- Friends cannot be forged as accepted rows by direct client insert.
- Votes are direct-write blocked and go through `toggle_post_vote()`.
- Notification inserts are direct-write blocked and go through controlled RPC helpers.
- Post media insert/update RLS enforces trusted Cloudinary/GIPHY source shapes.
- The old loose post_media insert policy is not present.
