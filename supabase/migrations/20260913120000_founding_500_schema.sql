-- Founding 500 schema, assignment guards, and profile RPC exposure.
-- Historical numbering is intentionally not performed here.

begin;

alter table public.profiles
  add column if not exists account_type text not null default 'user',
  add column if not exists founding_member_number integer;

alter table public.profiles
  drop constraint if exists profiles_account_type_check,
  add constraint profiles_account_type_check
    check (account_type in ('user', 'system', 'editorial', 'bot')),
  drop constraint if exists profiles_founding_member_number_range_check,
  add constraint profiles_founding_member_number_range_check
    check (
      founding_member_number is null
      or founding_member_number between 1 and 500
    ),
  drop constraint if exists profiles_founding_member_requires_user_check,
  add constraint profiles_founding_member_requires_user_check
    check (
      founding_member_number is null
      or account_type = 'user'
    );

create unique index if not exists profiles_founding_member_number_key
on public.profiles(founding_member_number)
where founding_member_number is not null;

create index if not exists profiles_account_type_idx
on public.profiles(account_type);

create table if not exists public.founding_member_numbers (
  number integer primary key,
  profile_id uuid,
  assigned_at timestamptz not null default now(),

  constraint founding_member_numbers_number_range_check
    check (number between 1 and 500)
);

alter table public.founding_member_numbers enable row level security;

revoke all on table public.founding_member_numbers from public;
revoke all on table public.founding_member_numbers from anon;
revoke all on table public.founding_member_numbers from authenticated;

create table if not exists public.founding_500_settings (
  singleton boolean primary key default true,
  is_auto_assignment_enabled boolean not null default false,
  updated_at timestamptz not null default now(),

  constraint founding_500_settings_singleton_check
    check (singleton = true)
);

insert into public.founding_500_settings (singleton, is_auto_assignment_enabled)
values (true, false)
on conflict (singleton) do nothing;

alter table public.founding_500_settings enable row level security;

revoke all on table public.founding_500_settings from public;
revoke all on table public.founding_500_settings from anon;
revoke all on table public.founding_500_settings from authenticated;

create or replace function public.set_founding_500_settings_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_founding_500_settings_updated_at() from public;

drop trigger if exists set_founding_500_settings_updated_at on public.founding_500_settings;
create trigger set_founding_500_settings_updated_at
before update on public.founding_500_settings
for each row
execute function public.set_founding_500_settings_updated_at();

create or replace function public.is_founding_500_auto_assignment_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select s.is_auto_assignment_enabled
      from public.founding_500_settings s
      where s.singleton = true
      limit 1
    ),
    false
  );
$$;

revoke all on function public.is_founding_500_auto_assignment_enabled() from public;

create or replace function public.set_founding_500_auto_assignment_enabled(
  p_enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_admin_or_above() then
    raise exception 'Admin permission required';
  end if;

  insert into public.founding_500_settings (
    singleton,
    is_auto_assignment_enabled,
    updated_at
  )
  values (true, coalesce(p_enabled, false), now())
  on conflict (singleton) do update
  set
    is_auto_assignment_enabled = excluded.is_auto_assignment_enabled,
    updated_at = now();

  return coalesce(p_enabled, false);
end;
$$;

revoke all on function public.set_founding_500_auto_assignment_enabled(boolean) from public;
grant execute on function public.set_founding_500_auto_assignment_enabled(boolean) to authenticated;

create or replace function public.claim_founding_member_number(
  p_profile_id uuid,
  p_requested_number integer default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_number integer;
begin
  if p_profile_id is null then
    raise exception 'Profile id is required';
  end if;

  perform pg_advisory_xact_lock(hashtext('triggerfeed_founding_500'));

  if p_requested_number is not null then
    if p_requested_number < 1 or p_requested_number > 500 then
      raise exception 'Founding Member number must be between 1 and 500';
    end if;

    if exists (
      select 1
      from public.founding_member_numbers fmn
      where fmn.number = p_requested_number
        and fmn.profile_id = p_profile_id
    ) then
      return p_requested_number;
    end if;

    insert into public.founding_member_numbers (number, profile_id)
    values (p_requested_number, p_profile_id);

    return p_requested_number;
  end if;

  select coalesce(max(fmn.number), 0) + 1
  into v_number
  from public.founding_member_numbers fmn;

  if v_number > 500 then
    return null;
  end if;

  insert into public.founding_member_numbers (number, profile_id)
  values (v_number, p_profile_id);

  return v_number;
end;
$$;

revoke all on function public.claim_founding_member_number(uuid, integer) from public;

create or replace function public.set_profile_founding_member_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
    and old.founding_member_number is not null
    and new.founding_member_number is distinct from old.founding_member_number
  then
    raise exception 'Founding Member numbers cannot be changed once assigned';
  end if;

  if new.founding_member_number is not null
    and new.account_type <> 'user'
  then
    raise exception 'Only user accounts can receive Founding Member numbers';
  end if;

  if tg_op = 'INSERT'
    and new.founding_member_number is null
    and new.account_type = 'user'
    and public.is_founding_500_auto_assignment_enabled()
  then
    new.founding_member_number := public.claim_founding_member_number(new.id);
  elsif new.founding_member_number is not null
    and (
      tg_op = 'INSERT'
      or old.founding_member_number is null
    )
  then
    perform public.claim_founding_member_number(
      new.id,
      new.founding_member_number
    );
  end if;

  return new;
end;
$$;

revoke all on function public.set_profile_founding_member_number() from public;

drop trigger if exists set_profile_founding_member_number_trigger on public.profiles;
create trigger set_profile_founding_member_number_trigger
before insert or update of account_type, founding_member_number
on public.profiles
for each row
execute function public.set_profile_founding_member_number();

update public.profiles
set account_type = 'system'
where lower(coalesce(username, '')) = lower('TF-One')
  and account_type = 'user'
  and founding_member_number is null;

update public.profiles
set account_type = 'editorial'
where lower(coalesce(username, '')) = lower('TF-News')
  and account_type = 'user'
  and founding_member_number is null;

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
  account_type text,
  founding_member_number integer,
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
    p.account_type,
    p.founding_member_number,
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

drop function if exists public.get_my_profile_auth_status();

create or replace function public.get_my_profile_auth_status()
returns table (
  id uuid,
  username text,
  role text,
  account_type text,
  dob date,
  age_verified_at timestamptz,
  is_banned boolean,
  is_muted boolean,
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
    p.account_type,
    p.dob,
    p.age_verified_at,
    coalesce(p.is_banned, false) as is_banned,
    coalesce(p.is_muted, false) as is_muted,
    coalesce(p.is_deleted, false) as is_deleted
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

revoke all on function public.get_my_profile_auth_status() from public;
grant execute on function public.get_my_profile_auth_status() to authenticated;

drop function if exists public.get_public_profile(uuid);

create or replace function public.get_public_profile(p_profile_id uuid)
returns table (
  id uuid,
  username text,
  display_name text,
  first_name text,
  last_name text,
  birthday_display text,
  email text,
  city text,
  state text,
  bio text,
  avatar_cloudinary_url text,
  banner_cloudinary_url text,
  profile_badge text,
  founding_member_number integer,
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
      when p.dob is not null
        and case
          when lower(p.privacy_settings #>> '{profile_visibility,show_birthday}') in ('true', 'false')
            then (p.privacy_settings #>> '{profile_visibility,show_birthday}')::boolean
          else false
        end then to_char(p.dob, 'FMMonth FMDD')
      else null
    end as birthday_display,
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
    p.founding_member_number,
    null::jsonb as privacy_settings,
    p.created_at,
    p.updated_at
  from public.profiles p
  where p.id = p_profile_id
    and coalesce(p.is_deleted, false) = false
  limit 1;
$$;

revoke all on function public.get_public_profile(uuid) from public;
grant execute on function public.get_public_profile(uuid) to anon, authenticated;

drop function if exists public.get_public_profile_cards(uuid[]);

create or replace function public.get_public_profile_cards(p_profile_ids uuid[])
returns table (
  id uuid,
  username text,
  display_name text,
  first_name text,
  last_name text,
  avatar_cloudinary_url text,
  profile_badge text,
  founding_member_number integer,
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
    p.founding_member_number,
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

drop function if exists public.get_friend_suggestions(integer);

create or replace function public.get_friend_suggestions(
  p_limit integer default 4
)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_cloudinary_url text,
  founding_member_number integer,
  suggestion_reason text,
  mutual_friend_count integer,
  rank_score integer
)
language sql
security definer
set search_path = public
as $$
  with viewer as (
    select
      p.id as viewer_id,
      nullif(lower(trim(p.state)), '') as viewer_state
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.is_banned, false) = false
      and coalesce(p.is_deleted, false) = false
      and p.account_type = 'user'
  ),
  existing_relationships as (
    select
      case
        when f.requester_id = auth.uid() then f.addressee_id
        else f.requester_id
      end as other_user_id,
      f.status
    from public.friends f
    where f.requester_id = auth.uid()
       or f.addressee_id = auth.uid()
  ),
  accepted_friends as (
    select er.other_user_id as friend_id
    from existing_relationships er
    where er.status = 'accepted'
  ),
  friend_edges as (
    select
      af.friend_id,
      case
        when f.requester_id = af.friend_id then f.addressee_id
        else f.requester_id
      end as candidate_id
    from accepted_friends af
    join public.friends f
      on f.status = 'accepted'
     and (
       f.requester_id = af.friend_id
       or f.addressee_id = af.friend_id
     )
  ),
  mutuals as (
    select
      fe.candidate_id,
      count(distinct fe.friend_id)::integer as mutual_friend_count
    from friend_edges fe
    where fe.candidate_id <> auth.uid()
    group by fe.candidate_id
  ),
  activity as (
    select
      recent.user_id,
      max(recent.activity_at) as recent_activity_at
    from (
      select
        p.user_id,
        greatest(p.created_at, p.updated_at) as activity_at
      from public.posts p
      where coalesce(p.is_deleted, false) = false
        and p.visibility = 'public'

      union all

      select
        c.user_id,
        greatest(c.created_at, c.updated_at) as activity_at
      from public.comments c
      where coalesce(c.is_deleted, false) = false
    ) recent
    group by recent.user_id
  ),
  candidates as (
    select
      p.id,
      p.username,
      p.display_name,
      p.avatar_cloudinary_url,
      p.founding_member_number,
      coalesce(m.mutual_friend_count, 0)::integer as mutual_friend_count,
      (
        v.viewer_state is not null
        and nullif(lower(trim(p.state)), '') is not null
        and nullif(lower(trim(p.state)), '') = v.viewer_state
      ) as same_state,
      a.recent_activity_at
    from public.profiles p
    cross join viewer v
    left join mutuals m
      on m.candidate_id = p.id
    left join activity a
      on a.user_id = p.id
    where p.id <> v.viewer_id
      and p.account_type = 'user'
      and coalesce(p.is_banned, false) = false
      and coalesce(p.is_deleted, false) = false
      and coalesce(p.is_muted, false) = false
      and not exists (
        select 1
        from existing_relationships er
        where er.other_user_id = p.id
      )
  ),
  ranked as (
    select
      c.*,
      case
        when c.mutual_friend_count > 0 and c.same_state then 400 + c.mutual_friend_count
        when c.mutual_friend_count > 0 then 300 + c.mutual_friend_count
        when c.same_state then 200
        when c.recent_activity_at is not null then 100
        else 0
      end as computed_rank_score
    from candidates c
  )
  select
    r.id,
    r.username,
    r.display_name,
    r.avatar_cloudinary_url,
    r.founding_member_number,
    case
      when r.mutual_friend_count > 0 and r.same_state then
        r.mutual_friend_count::text
        || case when r.mutual_friend_count = 1 then ' mutual friend' else ' mutual friends' end
        || ' · Also in your state'
      when r.mutual_friend_count > 0 then
        r.mutual_friend_count::text
        || case when r.mutual_friend_count = 1 then ' mutual friend' else ' mutual friends' end
      when r.same_state then 'Also in your state'
      else 'Active recently'
    end as suggestion_reason,
    r.mutual_friend_count,
    r.computed_rank_score as rank_score
  from ranked r
  where r.computed_rank_score > 0
  order by
    r.computed_rank_score desc,
    r.mutual_friend_count desc,
    r.recent_activity_at desc nulls last,
    random()
  limit least(greatest(coalesce(p_limit, 4), 1), 20);
$$;

revoke all on function public.get_friend_suggestions(integer) from public;
grant execute on function public.get_friend_suggestions(integer) to authenticated;

drop function if exists public.search_friend_candidates(text, integer);

create or replace function public.search_friend_candidates(
  p_query text,
  p_limit integer default 25
)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_cloudinary_url text,
  founding_member_number integer,
  city text,
  state text,
  friendship_status text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_viewer_id uuid := auth.uid();
  v_query text := lower(trim(regexp_replace(coalesce(p_query, ''), '^@+', '')));
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 50);
begin
  if v_viewer_id is null then
    raise exception 'Authentication required';
  end if;

  if v_query = '' then
    return;
  end if;

  return query
  with candidates as (
    select
      p.id,
      p.username,
      p.display_name,
      p.avatar_cloudinary_url,
      p.founding_member_number,
      case
        when lower(p.privacy_settings #>> '{profile_visibility,show_city}') in ('true', 'false')
          and (p.privacy_settings #>> '{profile_visibility,show_city}')::boolean
          then p.city
        else null
      end as city,
      case
        when lower(p.privacy_settings #>> '{profile_visibility,show_state}') in ('true', 'false')
          and (p.privacy_settings #>> '{profile_visibility,show_state}')::boolean
          then p.state
        else null
      end as state,
      relationship.status as friendship_status,
      case
        when starts_with(lower(coalesce(p.username, '')), v_query)
          or starts_with(lower(coalesce(p.display_name, '')), v_query)
          or starts_with(lower(coalesce(p.first_name, '')), v_query)
          or starts_with(lower(coalesce(p.last_name, '')), v_query)
          or starts_with(lower(
            concat_ws(
              ' ',
              nullif(trim(p.first_name), ''),
              nullif(trim(p.last_name), '')
            )
          ), v_query)
          then 0
        else 1
      end as match_rank
    from public.profiles p
    left join lateral (
      select f.status
      from public.friends f
      where
        (f.requester_id = v_viewer_id and f.addressee_id = p.id)
        or
        (f.requester_id = p.id and f.addressee_id = v_viewer_id)
      order by
        case f.status
          when 'accepted' then 0
          when 'pending' then 1
          when 'blocked' then 2
          else 3
        end,
        f.updated_at desc
      limit 1
    ) relationship on true
    where p.id <> v_viewer_id
      and p.account_type = 'user'
      and coalesce(p.is_deleted, false) = false
      and coalesce(p.is_banned, false) = false
      and (
        strpos(lower(coalesce(p.username, '')), v_query) > 0
        or strpos(lower(coalesce(p.display_name, '')), v_query) > 0
        or strpos(lower(coalesce(p.first_name, '')), v_query) > 0
        or strpos(lower(coalesce(p.last_name, '')), v_query) > 0
        or strpos(lower(
          concat_ws(
            ' ',
            nullif(trim(p.first_name), ''),
            nullif(trim(p.last_name), '')
          )
        ), v_query) > 0
      )
  )
  select
    c.id,
    c.username,
    c.display_name,
    c.avatar_cloudinary_url,
    c.founding_member_number,
    c.city,
    c.state,
    c.friendship_status
  from candidates c
  order by
    c.match_rank,
    lower(coalesce(c.username, '')),
    lower(coalesce(c.display_name, '')),
    c.id
  limit v_limit;
end;
$$;

revoke all on function public.search_friend_candidates(text, integer) from public;
grant execute on function public.search_friend_candidates(text, integer) to authenticated;

comment on column public.profiles.account_type is
  'Durable account classification. Only account_type = user is eligible for Founding 500 assignment.';

comment on column public.profiles.founding_member_number is
  'Permanent Founding 500 member number. Once assigned, it is immutable and never reused.';

comment on table public.founding_member_numbers is
  'Ledger of all Founding 500 numbers ever claimed. Rows are retained even if a profile is deleted.';

comment on table public.founding_500_settings is
  'Singleton settings for Founding 500 rollout. Auto-assignment starts only after reviewed historical numbering is applied.';

commit;
