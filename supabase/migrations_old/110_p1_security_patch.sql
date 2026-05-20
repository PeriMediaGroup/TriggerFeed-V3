-- supabase/migrations/110_p1_security_patch.sql
--
-- P1 Security Patch
-- Purpose:
-- 1. Prevent users from updating dangerous profile fields directly.
-- 2. Tighten friends RLS so users cannot self-create accepted friendships.
-- 3. Force post votes through toggle_post_vote() instead of direct table writes.
-- 4. Set Cloudinary DB config used by post_media RLS checks.
-- 5. Ensure expected security helper RPCs can be executed by authenticated users.
--
-- NOTE:
-- This patch is intentionally defensive. It drops existing policies on the affected
-- tables and replaces them with stricter versions where needed.

begin;

-- ---------------------------------------------------------------------------
-- 1. Cloudinary DB setting / post_media RLS compatibility
-- ---------------------------------------------------------------------------
-- Do NOT use alter database set app.cloudinary_cloud_name here.
-- Supabase local migration role may not have permission to set custom database
-- parameters, and session-level set_config() would not persist for app requests.
--
-- then that policy should be changed to use the literal expected Cloudinary
-- cloud name, or moved into a helper function that returns this value.
--
-- Expected Cloudinary cloud name:
-- triggerfeed
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 2. Profiles: lock down dangerous fields
-- ---------------------------------------------------------------------------
-- Problem:
-- Previous policy allowed users to update their own row, but grants/policies did
-- not prevent updating role, profile_badge, is_banned, is_deleted, etc.
--
-- Fix:
-- - Revoke broad update.
-- - Grant update only on safe profile-edit columns.
-- - Rebuild profile update policy.
-- - Revoke broad select and expose only safe public columns to anon/authenticated.
--
-- IMPORTANT APP NOTE:
-- Remove profile.email from public profile rendering.
-- Remove profile_badge from updateProfile.js FormData handling.
-- ---------------------------------------------------------------------------

alter table if exists public.profiles enable row level security;

-- Remove broad table-level grants from normal clients.
revoke update on table public.profiles from anon;
revoke update on table public.profiles from authenticated;

-- Avoid public/email leakage through broad select grants.
revoke select on table public.profiles from anon;
revoke select on table public.profiles from authenticated;

-- Keep insert available only if your app still creates profile rows from client-side
-- authenticated flows. If profile creation is handled by trigger/service role, this
-- grant is harmless but may be removed later.
grant insert on table public.profiles to authenticated;

-- Safe public/profile-read columns.
-- Do NOT include email, role, is_banned, is_deleted, or internal-only fields here.
grant select (
  id,
  username,
  display_name,
  first_name,
  last_name,
  city,
  state,
  bio,
  avatar_cloudinary_url,
  banner_cloudinary_url,
  profile_badge,
  created_at,
  updated_at
) on public.profiles to anon, authenticated;

-- Safe user-editable columns only.
-- Do NOT include:
-- role, email, profile_badge, is_banned, is_muted, is_deleted.
grant update (
  username,
  display_name,
  first_name,
  last_name,
  city,
  state,
  bio,
  avatar_cloudinary_url,
  avatar_cloudinary_public_id,
  banner_cloudinary_url,
  banner_cloudinary_public_id,
  privacy_settings,
  updated_at
) on public.profiles to authenticated;

-- Drop all existing profile UPDATE policies so no older broad update policy survives.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and cmd = 'UPDATE'
  loop
    execute format(
      'drop policy if exists %I on public.profiles',
      policy_record.policyname
    );
  end loop;
end $$;

-- Allow users to update only their own profile row.
-- Column-level grants above determine which columns can actually be updated.
create policy "profiles_update_own_safe_columns"
on public.profiles
for update
to authenticated
using (
  auth.uid() = id
)
with check (
  auth.uid() = id
);

-- Rebuild/select policy. This controls rows, while column grants control fields.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and cmd = 'SELECT'
  loop
    execute format(
      'drop policy if exists %I on public.profiles',
      policy_record.policyname
    );
  end loop;
end $$;

create policy "profiles_select_public_safe"
on public.profiles
for select
to anon, authenticated
using (
  coalesce(is_deleted, false) = false
);

-- ---------------------------------------------------------------------------
-- Profile auth status helper
-- ---------------------------------------------------------------------------
-- Lets the logged-in user check their own auth/profile gate status without
-- granting broad direct select access to is_banned or is_deleted.
-- ---------------------------------------------------------------------------

create or replace function public.get_my_profile_auth_status()
returns table (
  id uuid,
  username text,
  is_banned boolean,
  is_deleted boolean
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    p.username,
    p.is_banned,
    p.is_deleted
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

revoke all on function public.get_my_profile_auth_status() from public;
grant execute on function public.get_my_profile_auth_status() to authenticated;


-- ---------------------------------------------------------------------------
-- 3. Friends: prevent forged accepted friendships
-- ---------------------------------------------------------------------------
-- Problem:
-- Direct clients could insert friend rows with arbitrary status like "accepted".
--
-- Actual columns:
-- - requester_id uuid
-- - addressee_id uuid
-- - status text
-- - created_at timestamptz
-- - updated_at timestamptz
--
-- Rules:
-- - requester may insert only pending requests.
-- - involved users may view their own relationships.
-- - addressee may accept/decline pending requests.
-- - requester may cancel pending requests.
-- - either side may delete accepted friendships.
-- ---------------------------------------------------------------------------

alter table if exists public.friends enable row level security;

revoke all on table public.friends from anon;
revoke all on table public.friends from authenticated;

grant select, insert, delete on table public.friends to authenticated;

grant update (
  status,
  updated_at
) on public.friends to authenticated;

-- Drop existing friends policies and rebuild stricter set.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'friends'
  loop
    execute format(
      'drop policy if exists %I on public.friends',
      policy_record.policyname
    );
  end loop;
end $$;

create policy "friends_select_involved_users"
on public.friends
for select
to authenticated
using (
  auth.uid() = requester_id
  or auth.uid() = addressee_id
);

create policy "friends_insert_pending_only_by_requester"
on public.friends
for insert
to authenticated
with check (
  auth.uid() = requester_id
  and requester_id <> addressee_id
  and status = 'pending'
);

create policy "friends_addressee_updates_pending_request"
on public.friends
for update
to authenticated
using (
  auth.uid() = addressee_id
  and status = 'pending'
)
with check (
  auth.uid() = addressee_id
  and status in ('accepted', 'declined')
);

create policy "friends_requester_can_cancel_pending_request"
on public.friends
for delete
to authenticated
using (
  auth.uid() = requester_id
  and status = 'pending'
);

create policy "friends_either_user_can_remove_accepted_friendship"
on public.friends
for delete
to authenticated
using (
  status = 'accepted'
  and (
    auth.uid() = requester_id
    or auth.uid() = addressee_id
  )
);

-- ---------------------------------------------------------------------------
-- 4. Post votes: force voting through toggle_post_vote()
-- ---------------------------------------------------------------------------
-- Problem:
-- post_votes had direct insert/update/delete grants, allowing users to bypass
-- the safer RPC.
--
-- Fix:
-- - Revoke direct writes.
-- - Keep read access only for votes attached to visible public, non-deleted posts.
-- - Grant execute on toggle_post_vote() overloads.
-- ---------------------------------------------------------------------------

alter table if exists public.post_votes enable row level security;

revoke insert, update, delete on table public.post_votes from anon;
revoke insert, update, delete on table public.post_votes from authenticated;

revoke select on table public.post_votes from anon;
revoke select on table public.post_votes from authenticated;

grant select on table public.post_votes to authenticated;

-- Drop old post_votes policies and rebuild read-only policy.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'post_votes'
  loop
    execute format(
      'drop policy if exists %I on public.post_votes',
      policy_record.policyname
    );
  end loop;
end $$;

create policy "post_votes_select_for_visible_public_posts"
on public.post_votes
for select
to authenticated
using (
  exists (
    select 1
    from public.posts p
    where p.id = post_votes.post_id
      and coalesce(p.is_deleted, false) = false
      and p.visibility = 'public'
  )
);

-- Grant execute on all toggle_post_vote overloads, without guessing signature.
do $$
declare
  function_record record;
begin
  for function_record in
    select
      p.oid,
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'toggle_post_vote'
  loop
    execute format(
      'grant execute on function %I.%I(%s) to authenticated',
      function_record.schema_name,
      function_record.function_name,
      function_record.args
    );
  end loop;
end $$;


-- ---------------------------------------------------------------------------
-- 5. Notifications helper RPC grants
-- ---------------------------------------------------------------------------
-- Problem:
-- Direct notification inserts should not be used by client/app flows.
-- Mention notifications should go through create_mention_notification().
--
-- This does not fix JS by itself. createMentionNotifications.js still needs to
-- call the RPC instead of inserting directly into notifications.
-- ---------------------------------------------------------------------------

-- Keep direct notification inserts revoked for normal clients.
revoke insert on table public.notifications from anon;
revoke insert on table public.notifications from authenticated;

-- Grant execute on create_mention_notification overloads, without guessing args.
do $$
declare
  function_record record;
begin
  for function_record in
    select
      p.oid,
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'create_mention_notification'
  loop
    execute format(
      'grant execute on function %I.%I(%s) to authenticated',
      function_record.schema_name,
      function_record.function_name,
      function_record.args
    );
  end loop;
end $$;


-- ---------------------------------------------------------------------------
-- 6. Profile friend count helper grant
-- ---------------------------------------------------------------------------
-- Codex noted the app should use get_profile_friend_count() instead of directly
-- querying the RLS-protected friends table for public profile stats.
--
-- This grant makes sure the helper can be called.
-- ---------------------------------------------------------------------------

do $$
declare
  function_record record;
begin
  for function_record in
    select
      p.oid,
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_profile_friend_count'
  loop
    execute format(
      'grant execute on function %I.%I(%s) to anon, authenticated',
      function_record.schema_name,
      function_record.function_name,
      function_record.args
    );
  end loop;
end $$;


commit;