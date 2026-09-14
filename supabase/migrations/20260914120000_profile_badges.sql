-- Reusable public profile badges.
--
-- Founding 500 numbers remain authoritative on public.profiles and
-- public.founding_member_numbers. The generic badge assignment below is a
-- display layer that lets clients fetch profile badges consistently.

create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  icon_key text,
  variant text not null default 'default',
  display_order integer not null default 0,
  target_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint badges_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint badges_variant_format_check
    check (variant ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table if not exists public.user_badges (
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  primary key (user_id, badge_id),
  constraint user_badges_metadata_object_check
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists badges_active_order_idx
on public.badges(is_active, display_order, slug);

create index if not exists user_badges_badge_id_idx
on public.user_badges(badge_id);

alter table public.badges enable row level security;
alter table public.user_badges enable row level security;

revoke all on table public.badges from public;
revoke all on table public.badges from anon;
revoke all on table public.badges from authenticated;
revoke all on table public.user_badges from public;
revoke all on table public.user_badges from anon;
revoke all on table public.user_badges from authenticated;

create or replace function public.set_badges_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_badges_updated_at() from public;

drop trigger if exists set_badges_updated_at_trigger on public.badges;
create trigger set_badges_updated_at_trigger
before update on public.badges
for each row
execute function public.set_badges_updated_at();

insert into public.badges (
  slug,
  name,
  description,
  icon_key,
  variant,
  display_order,
  target_url,
  is_active
)
values (
  'founding-500',
  'Founding 500',
  'Member of the original Founding 500',
  'medal',
  'founding',
  10,
  '/founding-500',
  true
)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  icon_key = excluded.icon_key,
  variant = excluded.variant,
  display_order = excluded.display_order,
  target_url = excluded.target_url,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.user_badges (user_id, badge_id, awarded_at)
select
  p.id,
  b.id,
  coalesce(fmn.assigned_at, p.created_at, now())
from public.profiles p
join public.badges b
  on b.slug = 'founding-500'
left join public.founding_member_numbers fmn
  on fmn.profile_id = p.id
 and fmn.number = p.founding_member_number
where p.account_type = 'user'
  and p.founding_member_number is not null
on conflict (user_id, badge_id) do update
set awarded_at = excluded.awarded_at;

create or replace function public.sync_founding_500_badge_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_badge_id uuid;
  v_assigned_at timestamptz;
begin
  if new.account_type = 'user' and new.founding_member_number is not null then
    select id
    into v_badge_id
    from public.badges
    where slug = 'founding-500'
      and is_active = true;

    if v_badge_id is not null then
      select fmn.assigned_at
      into v_assigned_at
      from public.founding_member_numbers fmn
      where fmn.profile_id = new.id
        and fmn.number = new.founding_member_number;

      insert into public.user_badges (user_id, badge_id, awarded_at)
      values (new.id, v_badge_id, coalesce(v_assigned_at, new.created_at, now()))
      on conflict (user_id, badge_id) do update
      set awarded_at = excluded.awarded_at;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_founding_500_badge_assignment() from public;

drop trigger if exists sync_founding_500_badge_assignment_trigger on public.profiles;
create trigger sync_founding_500_badge_assignment_trigger
after insert or update of account_type, founding_member_number on public.profiles
for each row
execute function public.sync_founding_500_badge_assignment();

create or replace function public.get_public_profile_badges(p_profile_ids uuid[])
returns table (
  user_id uuid,
  badge_slug text,
  name text,
  description text,
  icon_key text,
  variant text,
  display_order integer,
  target_url text,
  awarded_at timestamptz,
  metadata jsonb,
  founding_member_number integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id as user_id,
    b.slug as badge_slug,
    b.name,
    b.description,
    b.icon_key,
    b.variant,
    b.display_order,
    b.target_url,
    ub.awarded_at,
    ub.metadata,
    case
      when b.slug = 'founding-500' then p.founding_member_number
      else null
    end as founding_member_number
  from public.user_badges ub
  join public.badges b
    on b.id = ub.badge_id
   and b.is_active = true
  join public.profiles p
    on p.id = ub.user_id
  where p.id = any(coalesce(p_profile_ids, array[]::uuid[]))
    and p.account_type = 'user'
    and coalesce(p.is_deleted, false) = false
    and (
      b.slug <> 'founding-500'
      or p.founding_member_number is not null
    )
  order by p.id, b.display_order, ub.awarded_at, b.slug;
$$;

revoke all on function public.get_public_profile_badges(uuid[]) from public;
grant execute on function public.get_public_profile_badges(uuid[]) to anon, authenticated;

create or replace function public.award_user_badge(
  p_user_id uuid,
  p_badge_slug text,
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_badge_id uuid;
begin
  if auth.uid() is null or not public.is_admin_or_above() then
    raise exception 'Only administrators can award profile badges.';
  end if;

  if coalesce(jsonb_typeof(p_metadata), 'object') <> 'object' then
    raise exception 'Badge metadata must be a JSON object.';
  end if;

  select b.id
  into v_badge_id
  from public.badges b
  where b.slug = p_badge_slug
    and b.is_active = true;

  if v_badge_id is null then
    raise exception 'Badge does not exist or is inactive.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.account_type = 'user'
      and coalesce(p.is_deleted, false) = false
  ) then
    raise exception 'Badges can only be awarded to active user profiles.';
  end if;

  insert into public.user_badges (user_id, badge_id, metadata)
  values (p_user_id, v_badge_id, coalesce(p_metadata, '{}'::jsonb))
  on conflict (user_id, badge_id) do update
  set metadata = excluded.metadata;

  return true;
end;
$$;

revoke all on function public.award_user_badge(uuid, text, jsonb) from public;
grant execute on function public.award_user_badge(uuid, text, jsonb) to authenticated;

comment on table public.badges is
  'Reusable badge definitions for public profile display. Roles and permissions are not badges.';

comment on table public.user_badges is
  'Badge assignments for user profiles. Founding 500 numbers remain authoritative on profiles and founding_member_numbers.';

comment on function public.get_public_profile_badges(uuid[]) is
  'Returns public-safe badge display data for active user profiles only.';
