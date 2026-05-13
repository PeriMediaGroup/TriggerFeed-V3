-- =========================================================
-- Stage 1: Profiles Foundation
-- Creates user profile records tied to Supabase auth users.
-- =========================================================

create extension if not exists pgcrypto;

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

  privacy_settings jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_role_check
    check (role in ('user', 'admin', 'ceo'))
);

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_profiles_username_lower()
returns trigger
language plpgsql
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

drop trigger if exists set_profiles_username_lower_trigger
on public.profiles;

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

alter table public.profiles enable row level security;

grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;

drop policy if exists "Anyone can read non-deleted profiles"
on public.profiles;

create policy "Anyone can read non-deleted profiles"
on public.profiles
for select
using (
  is_deleted = false
);

drop policy if exists "Users can insert their own profile"
on public.profiles;

create policy "Users can insert their own profile"
on public.profiles
for insert
to authenticated
with check (
  auth.uid() = id
);

drop policy if exists "Users can update their own profile"
on public.profiles;

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (
  auth.uid() = id
)
with check (
  auth.uid() = id
);

create index if not exists profiles_username_lower_idx
on public.profiles(username_lower);

create index if not exists profiles_display_name_idx
on public.profiles(display_name);

create index if not exists profiles_is_deleted_idx
on public.profiles(is_deleted);