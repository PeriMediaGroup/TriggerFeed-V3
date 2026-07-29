# Verification Checklist

Use this checklist for a production-readiness rehearsal. Do not run destructive steps against production until backups, restore proof, and owner approval are complete.

## Static checks

- [ ] Confirm no committed `.env`, `.env.local`, dumps, or generated media are included in release artifacts.
- [ ] Confirm no script contains a concrete production or legacy connection string.
- [ ] Confirm remote scripts require `TRIGGERFEED_V3_DB_URL` and reject localhost targets.
- [ ] Confirm scripts do not print database URLs, tokens, session values, or service-role keys.
- [ ] Run `npx supabase db lint` and resolve or formally waive every error.
- [ ] Run a fresh local `supabase db reset` only in an approved disposable local environment.
- [ ] Confirm all migrations apply in lexical order from an empty database.
- [ ] Confirm seed remains disabled for production.

## Data rehearsal checks

- [ ] Create a disposable remote-like Supabase project or isolated database.
- [ ] Restore schema from migrations only.
- [ ] Import users/auth identities first.
- [ ] Verify profile count, auth user count, and missing-profile count.
- [ ] Import posts and media.
- [ ] Verify post count, media count, visibility breakdown, and removed/flagged post treatment.
- [ ] Import comments.
- [ ] Verify comment count, parent-child integrity, and accepted dropped-comment count.
- [ ] Import friends.
- [ ] Verify no self-friends, no duplicate normalized pairs, and accepted dropped-friend count.
- [ ] Import votes.
- [ ] Verify no duplicate user/post votes and accepted dropped-vote count.
- [ ] Decide whether `public.migration_old_*` staging tables are retained or removed after validation.

## Application smoke checks

- [ ] Anonymous feed/profile reads behave as expected.
- [ ] Authenticated user can sign in.
- [ ] Authenticated user can create text and image posts.
- [ ] User can view migrated posts with media.
- [ ] User can comment on migrated posts.
- [ ] User can vote on migrated posts.
- [ ] Friend state and friend counts match sampled legacy expectations.
- [ ] Admin/CEO can access intended admin surfaces.
- [ ] Moderator cannot access CEO/admin-only actions.
- [ ] Abuse report function works with JWT verification enabled.

## SQL verification examples

Run equivalent count checks after migration, using the approved production-safe connection method:

```sql
select count(*) from auth.users;
select count(*) from public.profiles;
select count(*) from public.posts;
select count(*) from public.post_media;
select count(*) from public.comments;
select count(*) from public.friends;
select count(*) from public.post_votes;
```

Add orphan and duplicate checks per imported entity before accepting cutover.

## Current lint evidence

During this audit, `npx supabase db lint` exited `0` but returned an error-level finding for `public.get_admin_nav_counts`: relation `public.moderation_reviews` does not exist. Resolve or explicitly waive this before cutover.
