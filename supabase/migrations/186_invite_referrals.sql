-- 186: Invite Friends referrals

begin;

create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists referral_code text;

create or replace function public.generate_referral_code()
returns text
language plpgsql
set search_path = public
as $$
declare
  v_code text;
begin
  loop
    v_code := substring(
      translate(encode(extensions.gen_random_bytes(9), 'base64'), '+/=', '-_')
      from 1 for 12
    );

    exit when not exists (
      select 1
      from public.profiles p
      where p.referral_code = v_code
    );
  end loop;

  return v_code;
end;
$$;

revoke all on function public.generate_referral_code() from public;

update public.profiles
set referral_code = public.generate_referral_code()
where referral_code is null;

alter table public.profiles
  alter column referral_code set not null,
  add constraint profiles_referral_code_format_check
    check (referral_code ~ '^[A-Za-z0-9_-]{8,32}$');

create unique index if not exists profiles_referral_code_idx
on public.profiles(referral_code);

create or replace function public.set_profiles_referral_code()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.referral_code := coalesce(
      nullif(trim(new.referral_code), ''),
      public.generate_referral_code()
    );
  elsif tg_op = 'UPDATE'
    and old.referral_code is not null
    and new.referral_code is distinct from old.referral_code
  then
    raise exception 'Profile referral codes cannot be changed';
  end if;

  return new;
end;
$$;

revoke all on function public.set_profiles_referral_code() from public;

drop trigger if exists set_profiles_referral_code_trigger on public.profiles;
create trigger set_profiles_referral_code_trigger
before insert or update of referral_code
on public.profiles
for each row
execute function public.set_profiles_referral_code();

create table if not exists public.user_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references public.profiles(id) on delete restrict,
  referred_user_id uuid not null references public.profiles(id) on delete restrict,
  referral_code text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  converted_at timestamptz,

  constraint user_referrals_status_check
    check (status in ('pending', 'converted', 'disqualified')),
  constraint user_referrals_no_self_referral_check
    check (referrer_user_id <> referred_user_id),
  constraint user_referrals_referred_once_key
    unique (referred_user_id),
  constraint user_referrals_referrer_referred_key
    unique (referrer_user_id, referred_user_id),
  constraint user_referrals_converted_at_check
    check (status <> 'converted' or converted_at is not null)
);

create index if not exists user_referrals_referrer_user_id_idx
on public.user_referrals(referrer_user_id);

create index if not exists user_referrals_referral_code_idx
on public.user_referrals(referral_code);

create index if not exists user_referrals_status_idx
on public.user_referrals(status);

alter table public.user_referrals enable row level security;

revoke all on public.user_referrals from anon;
revoke all on public.user_referrals from authenticated;

create table if not exists public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.user_referrals(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  reward_type text not null,
  reward_value jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  awarded_at timestamptz,

  constraint referral_rewards_status_check
    check (status in ('pending', 'awarded', 'disqualified', 'canceled')),
  constraint referral_rewards_awarded_at_check
    check (status <> 'awarded' or awarded_at is not null)
);

create index if not exists referral_rewards_referral_id_idx
on public.referral_rewards(referral_id);

create index if not exists referral_rewards_user_id_idx
on public.referral_rewards(user_id);

create index if not exists referral_rewards_status_idx
on public.referral_rewards(status);

alter table public.referral_rewards enable row level security;

revoke all on public.referral_rewards from anon;
revoke all on public.referral_rewards from authenticated;

create or replace function public.record_user_referral_from_code(
  p_referred_user_id uuid,
  p_referral_code text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_referrer_user_id uuid;
  v_referral_id uuid;
begin
  v_code := nullif(trim(coalesce(p_referral_code, '')), '');

  if v_code is null or v_code !~ '^[A-Za-z0-9_-]{8,64}$' then
    return null;
  end if;

  select p.id
  into v_referrer_user_id
  from public.profiles p
  where p.referral_code = v_code
    and coalesce(p.is_deleted, false) = false
  limit 1;

  if v_referrer_user_id is null
    or v_referrer_user_id = p_referred_user_id
  then
    return null;
  end if;

  insert into public.user_referrals (
    referrer_user_id,
    referred_user_id,
    referral_code,
    status,
    converted_at
  )
  values (
    v_referrer_user_id,
    p_referred_user_id,
    v_code,
    'converted',
    now()
  )
  on conflict (referred_user_id) do nothing
  returning id into v_referral_id;

  return v_referral_id;
exception
  when others then
    raise warning 'Referral attribution failed for referred user %: %',
      p_referred_user_id,
      sqlerrm;
    return null;
end;
$$;

revoke all on function public.record_user_referral_from_code(uuid, text) from public;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dob date;
  v_age_gate_version text;
  v_birthday_messages_enabled boolean;
begin
  begin
    if new.raw_user_meta_data ? 'dob'
      and (new.raw_user_meta_data->>'dob') ~ '^\d{4}-\d{2}-\d{2}$'
    then
      v_dob := (new.raw_user_meta_data->>'dob')::date;
    end if;
  exception
    when others then
      v_dob := null;
  end;

  v_age_gate_version := nullif(trim(coalesce(new.raw_user_meta_data->>'age_gate_version', '')), '');
  v_birthday_messages_enabled := coalesce(
    case
      when lower(coalesce(new.raw_user_meta_data->>'birthday_messages_enabled', '')) in ('true', 't', '1', 'yes')
        then true
      when lower(coalesce(new.raw_user_meta_data->>'birthday_messages_enabled', '')) in ('false', 'f', '0', 'no')
        then false
      else null
    end,
    true
  );

  insert into public.profiles (
    id,
    email,
    username,
    display_name,
    first_name,
    last_name,
    dob,
    age_verified_at,
    age_gate_version,
    birthday_messages_enabled,
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
    case when public.is_adult_dob(v_dob) then v_dob else null end,
    case when public.is_adult_dob(v_dob) then now() else null end,
    coalesce(v_age_gate_version, 'v1'),
    v_birthday_messages_enabled,
    now(),
    now()
  )
  on conflict (id) do update
  set
    email = excluded.email,
    dob = coalesce(public.profiles.dob, excluded.dob),
    age_verified_at = coalesce(public.profiles.age_verified_at, excluded.age_verified_at),
    age_gate_version = coalesce(nullif(public.profiles.age_gate_version, ''), excluded.age_gate_version, 'v1'),
    birthday_messages_enabled = coalesce(public.profiles.birthday_messages_enabled, excluded.birthday_messages_enabled, true),
    updated_at = now();

  perform public.record_user_referral_from_code(
    new.id,
    new.raw_user_meta_data->>'referral_code'
  );

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;

drop function if exists public.get_my_profile();

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
  dob date,
  age_verified_at timestamptz,
  age_gate_version text,
  birthday_messages_enabled boolean,
  privacy_settings jsonb,
  referral_code text,
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
    p.dob,
    p.age_verified_at,
    p.age_gate_version,
    p.birthday_messages_enabled,
    p.privacy_settings,
    p.referral_code,
    p.created_at,
    p.updated_at
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

revoke all on function public.get_my_profile() from public;
grant execute on function public.get_my_profile() to authenticated;

comment on table public.user_referrals is
  'Permanent invite/referral attribution history. Rewards are intentionally modeled separately.';

comment on table public.referral_rewards is
  'Future-ready referral reward ledger. V1 does not create or surface reward rows.';

commit;
