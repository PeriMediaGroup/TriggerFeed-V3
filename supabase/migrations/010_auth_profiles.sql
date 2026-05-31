-- =========================================================
-- 010: Auth, Profiles, and Auth Events
-- Clean consolidated baseline for TriggerFeed V3.
-- =========================================================

begin;

create extension if not exists pgcrypto;

grant usage on schema public to anon, authenticated;

-- ---------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,

  email text,
  username text unique,
  username_lower text unique,
  display_name text,
  first_name text,
  last_name text,
  city text,
  state text,
  bio text,

  avatar_cloudinary_url text,
  avatar_cloudinary_public_id text,
  banner_cloudinary_url text,
  banner_cloudinary_public_id text,

  role text not null default 'user',
  profile_badge text,

  is_banned boolean not null default false,
  is_muted boolean not null default false,
  is_deleted boolean not null default false,

  privacy_settings jsonb not null default '{
    "profile_visibility": {
      "show_city": false,
      "show_state": false,
      "show_email": false,
      "show_real_name": false
    }
  }'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_role_check
    check (role in ('user', 'admin', 'ceo')),

  constraint profiles_username_length_check
    check (username is null or char_length(username) between 3 and 32),

  constraint profiles_username_format_check
    check (username is null or username ~ '^[A-Za-z0-9_]+$'),

  constraint profiles_bio_length_check
    check (bio is null or char_length(bio) <= 500)
);

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_profiles_username_lower()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.username is not null then
    new.username_lower = lower(new.username);
  else
    new.username_lower = null;
  end if;

  return new;
end;
$$;

drop trigger if exists set_profiles_username_lower_trigger on public.profiles;
create trigger set_profiles_username_lower_trigger
before insert or update of username
on public.profiles
for each row
execute function public.set_profiles_username_lower();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_profiles_updated_at();

create index if not exists profiles_username_lower_idx
on public.profiles(username_lower);

create index if not exists profiles_display_name_idx
on public.profiles(display_name);

create index if not exists profiles_is_deleted_idx
on public.profiles(is_deleted);

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;

-- Public/logged-out profile reads. No email, role, banned/deleted/muted flags.
grant select (
  id,
  username,
  username_lower,
  display_name,
  bio,
  avatar_cloudinary_url,
  banner_cloudinary_url,
  profile_badge,
  created_at,
  updated_at
) on public.profiles to anon;

-- Logged-in profile reads. Still no email. Role is intentionally not granted here;
-- use get_my_profile_auth_status() or a future admin-only RPC for permission checks.
grant select (
  id,
  username,
  username_lower,
  display_name,
  bio,
  avatar_cloudinary_url,
  banner_cloudinary_url,
  profile_badge,
  created_at,
  updated_at
) on public.profiles to authenticated;

-- Allow only safe client-side profile inserts. The signup trigger uses security definer.
grant insert (
  id,
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
  created_at,
  updated_at
) on public.profiles to authenticated;

-- Safe user-editable profile columns only.
-- Never grant direct user updates to role, profile_badge, is_banned,
-- is_muted, or is_deleted.
grant update (
  email,
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

create policy "profiles_select_visible"
on public.profiles
for select
to anon, authenticated
using (
  coalesce(is_deleted, false) = false
);

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (
  auth.uid() = id
);

create policy "profiles_insert_own_safe"
on public.profiles
for insert
to authenticated
with check (
  auth.uid() = id
);

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

-- ---------------------------------------------------------
-- Current-user auth/profile gate helper
-- ---------------------------------------------------------

create or replace function public.get_my_profile_auth_status()
returns table (
  id uuid,
  username text,
  role text,
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
    p.role,
    coalesce(p.is_banned, false) as is_banned,
    coalesce(p.is_deleted, false) as is_deleted
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

revoke all on function public.get_my_profile_auth_status() from public;
grant execute on function public.get_my_profile_auth_status() to authenticated;

create or replace function public.get_my_profile()
returns table (
  id uuid,
  email text,
  username text,
  first_name text,
  last_name text,
  display_name text,
  avatar_cloudinary_url text,
  banner_cloudinary_url text,
  profile_badge text,
  city text,
  state text,
  bio text,
  privacy_settings jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.email,
    p.username,
    p.first_name,
    p.last_name,
    p.display_name,
    p.avatar_cloudinary_url,
    p.banner_cloudinary_url,
    p.profile_badge,
    p.city,
    p.state,
    p.bio,
    p.privacy_settings,
    p.created_at,
    p.updated_at
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

revoke all on function public.get_my_profile() from public;
grant execute on function public.get_my_profile() to authenticated;

create or replace function public.get_public_profile(p_profile_id uuid)
returns table (
  id uuid,
  username text,
  display_name text,
  first_name text,
  last_name text,
  email text,
  city text,
  state text,
  bio text,
  avatar_cloudinary_url text,
  banner_cloudinary_url text,
  profile_badge text,
  privacy_settings jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.username,
    p.display_name,
    case
      when case
        when lower(p.privacy_settings #>> '{profile_visibility,show_real_name}') in ('true', 'false')
          then (p.privacy_settings #>> '{profile_visibility,show_real_name}')::boolean
        else false
      end then p.first_name
      else null
    end as first_name,
    case
      when case
        when lower(p.privacy_settings #>> '{profile_visibility,show_real_name}') in ('true', 'false')
          then (p.privacy_settings #>> '{profile_visibility,show_real_name}')::boolean
        else false
      end then p.last_name
      else null
    end as last_name,
    case
      when case
        when lower(p.privacy_settings #>> '{profile_visibility,show_email}') in ('true', 'false')
          then (p.privacy_settings #>> '{profile_visibility,show_email}')::boolean
        else false
      end then p.email
      else null
    end as email,
    case
      when case
        when lower(p.privacy_settings #>> '{profile_visibility,show_city}') in ('true', 'false')
          then (p.privacy_settings #>> '{profile_visibility,show_city}')::boolean
        else false
      end then p.city
      else null
    end as city,
    case
      when case
        when lower(p.privacy_settings #>> '{profile_visibility,show_state}') in ('true', 'false')
          then (p.privacy_settings #>> '{profile_visibility,show_state}')::boolean
        else false
      end then p.state
      else null
    end as state,
    p.bio,
    p.avatar_cloudinary_url,
    p.banner_cloudinary_url,
    p.profile_badge,
    p.privacy_settings,
    p.created_at,
    p.updated_at
  from public.profiles p
  where p.id = p_profile_id
    and coalesce(p.is_deleted, false) = false
  limit 1;
$$;

revoke all on function public.get_public_profile(uuid) from public;
grant execute on function public.get_public_profile(uuid) to anon, authenticated;

create or replace function public.get_public_profile_cards(p_profile_ids uuid[])
returns table (
  id uuid,
  username text,
  display_name text,
  first_name text,
  last_name text,
  avatar_cloudinary_url text,
  profile_badge text,
  city text,
  state text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.username,
    p.display_name,
    case
      when case
        when lower(p.privacy_settings #>> '{profile_visibility,show_real_name}') in ('true', 'false')
          then (p.privacy_settings #>> '{profile_visibility,show_real_name}')::boolean
        else false
      end then p.first_name
      else null
    end as first_name,
    case
      when case
        when lower(p.privacy_settings #>> '{profile_visibility,show_real_name}') in ('true', 'false')
          then (p.privacy_settings #>> '{profile_visibility,show_real_name}')::boolean
        else false
      end then p.last_name
      else null
    end as last_name,
    p.avatar_cloudinary_url,
    p.profile_badge,
    case
      when case
        when lower(p.privacy_settings #>> '{profile_visibility,show_city}') in ('true', 'false')
          then (p.privacy_settings #>> '{profile_visibility,show_city}')::boolean
        else false
      end then p.city
      else null
    end as city,
    case
      when case
        when lower(p.privacy_settings #>> '{profile_visibility,show_state}') in ('true', 'false')
          then (p.privacy_settings #>> '{profile_visibility,show_state}')::boolean
        else false
      end then p.state
      else null
    end as state
  from public.profiles p
  where p.id = any(p_profile_ids)
    and coalesce(p.is_deleted, false) = false;
$$;

revoke all on function public.get_public_profile_cards(uuid[]) from public;
grant execute on function public.get_public_profile_cards(uuid[]) to anon, authenticated;

create or replace function public.is_profile_visible(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_profile_id
      and coalesce(p.is_deleted, false) = false
  );
$$;

revoke all on function public.is_profile_visible(uuid) from public;
grant execute on function public.is_profile_visible(uuid) to anon, authenticated;

-- ---------------------------------------------------------
-- Auth events
-- ---------------------------------------------------------

create table if not exists public.auth_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  event_type text not null,
  success boolean not null default true,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint auth_events_event_type_not_blank_check
    check (char_length(trim(event_type)) > 0)
);

alter table public.auth_events enable row level security;

revoke all on public.auth_events from anon;
revoke all on public.auth_events from authenticated;

grant insert on public.auth_events to anon, authenticated;
grant select on public.auth_events to authenticated;

create policy "auth_events_insert_anon_pre_auth"
on public.auth_events
for insert
to anon
with check (user_id is null);

create policy "auth_events_insert_own_or_pre_auth"
on public.auth_events
for insert
to authenticated
with check (
  user_id = auth.uid()
  or user_id is null
);

create policy "auth_events_select_own"
on public.auth_events
for select
to authenticated
using (auth.uid() = user_id);

create index if not exists auth_events_user_id_idx
on public.auth_events(user_id);

create index if not exists auth_events_email_idx
on public.auth_events(email);

create index if not exists auth_events_event_type_idx
on public.auth_events(event_type);

create index if not exists auth_events_created_at_idx
on public.auth_events(created_at desc);

-- ---------------------------------------------------------
-- Create profile on signup
-- ---------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    username,
    display_name,
    first_name,
    last_name,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data->>'username', ''),
    nullif(new.raw_user_meta_data->>'display_name', ''),
    nullif(new.raw_user_meta_data->>'first_name', ''),
    nullif(new.raw_user_meta_data->>'last_name', ''),
    now(),
    now()
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

commit;
