-- =========================================================
-- Profile Types, Public Profile Metadata, And Verified Badge
-- =========================================================

begin;

alter table public.profiles
  add column if not exists profile_type text not null default 'member',
  drop constraint if exists profiles_profile_type_check,
  add constraint profiles_profile_type_check
    check (profile_type in ('member', 'creator', 'organization', 'system')),
  drop constraint if exists profiles_founding_member_profile_type_check,
  add constraint profiles_founding_member_profile_type_check
    check (
      founding_member_number is null
      or profile_type in ('member', 'creator')
    );

create index if not exists profiles_profile_type_idx
on public.profiles(profile_type);

update public.profiles
set profile_type = 'system'
where account_type in ('system', 'editorial', 'bot');

create table if not exists public.profile_metadata (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  category text,
  subtype text,
  website_url text,
  primary_link_url text,
  primary_link_label text,
  social_links jsonb not null default '[]'::jsonb,
  public_contact_email text,
  public_contact_phone text,
  public_location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_metadata_social_links_array_check
    check (jsonb_typeof(social_links) = 'array'),
  constraint profile_metadata_category_length_check
    check (category is null or char_length(category) <= 80),
  constraint profile_metadata_subtype_length_check
    check (subtype is null or char_length(subtype) <= 80),
  constraint profile_metadata_website_url_length_check
    check (website_url is null or char_length(website_url) <= 500),
  constraint profile_metadata_primary_link_url_length_check
    check (primary_link_url is null or char_length(primary_link_url) <= 500),
  constraint profile_metadata_primary_link_label_length_check
    check (primary_link_label is null or char_length(primary_link_label) <= 80),
  constraint profile_metadata_public_contact_email_length_check
    check (public_contact_email is null or char_length(public_contact_email) <= 254),
  constraint profile_metadata_public_contact_phone_length_check
    check (public_contact_phone is null or char_length(public_contact_phone) <= 40),
  constraint profile_metadata_public_location_length_check
    check (public_location is null or char_length(public_location) <= 120)
);

alter table public.profile_metadata enable row level security;

revoke all on table public.profile_metadata from public;
revoke all on table public.profile_metadata from anon;
revoke all on table public.profile_metadata from authenticated;

create or replace function public.set_profile_metadata_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_profile_metadata_updated_at() from public;

drop trigger if exists set_profile_metadata_updated_at_trigger on public.profile_metadata;
create trigger set_profile_metadata_updated_at_trigger
before update on public.profile_metadata
for each row
execute function public.set_profile_metadata_updated_at();

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
  'verified',
  'Verified',
  'TriggerFeed has confirmed this account represents the stated person, creator, or organization.',
  'badge-check',
  'verified',
  5,
  null,
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
  is_active = true;

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
    and (
      new.account_type <> 'user'
      or new.profile_type not in ('member', 'creator')
    )
  then
    raise exception 'Only member or creator user accounts can receive Founding Member numbers';
  end if;

  if tg_op = 'INSERT'
    and new.founding_member_number is null
    and new.account_type = 'user'
    and new.profile_type in ('member', 'creator')
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
before insert or update of account_type, profile_type, founding_member_number
on public.profiles
for each row
execute function public.set_profile_founding_member_number();

drop trigger if exists sync_founding_500_badge_assignment_trigger on public.profiles;
create trigger sync_founding_500_badge_assignment_trigger
after insert or update of account_type, profile_type, founding_member_number on public.profiles
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
    and p.profile_type <> 'system'
    and coalesce(p.is_deleted, false) = false
    and (
      b.slug <> 'founding-500'
      or (
        p.profile_type in ('member', 'creator')
        and p.founding_member_number is not null
      )
    )
  order by p.id, b.display_order, ub.awarded_at, b.slug;
$$;

revoke all on function public.get_public_profile_badges(uuid[]) from public;
grant execute on function public.get_public_profile_badges(uuid[]) to anon, authenticated;

create or replace function public.get_public_profile_metadata(p_profile_ids uuid[])
returns table (
  user_id uuid,
  profile_type text,
  category text,
  subtype text,
  website_url text,
  primary_link_url text,
  primary_link_label text,
  social_links jsonb,
  public_contact_email text,
  public_contact_phone text,
  public_location text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id as user_id,
    p.profile_type,
    case when p.profile_type in ('creator', 'organization') then pm.category else null end,
    case when p.profile_type in ('creator', 'organization') then pm.subtype else null end,
    case when p.profile_type in ('creator', 'organization') then pm.website_url else null end,
    case when p.profile_type in ('creator', 'organization') then pm.primary_link_url else null end,
    case when p.profile_type in ('creator', 'organization') then pm.primary_link_label else null end,
    case
      when p.profile_type in ('creator', 'organization')
        then coalesce(pm.social_links, '[]'::jsonb)
      else '[]'::jsonb
    end,
    case when p.profile_type in ('creator', 'organization') then pm.public_contact_email else null end,
    case when p.profile_type in ('creator', 'organization') then pm.public_contact_phone else null end,
    case when p.profile_type in ('creator', 'organization') then pm.public_location else null end
  from public.profiles p
  left join public.profile_metadata pm
    on pm.user_id = p.id
  where p.id = any(coalesce(p_profile_ids, array[]::uuid[]))
    and coalesce(p.is_deleted, false) = false;
$$;

revoke all on function public.get_public_profile_metadata(uuid[]) from public;
grant execute on function public.get_public_profile_metadata(uuid[]) to anon, authenticated;

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
  v_profile_type text;
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

  if p_badge_slug = 'founding-500' then
    raise exception 'Founding 500 badges are assigned by the Founding Member number system.';
  end if;

  select p.profile_type
  into v_profile_type
  from public.profiles p
  where p.id = p_user_id
    and p.account_type = 'user'
    and p.profile_type <> 'system'
    and coalesce(p.is_deleted, false) = false;

  if v_profile_type is null then
    raise exception 'Badges can only be awarded to active user profiles.';
  end if;

  if p_badge_slug = 'verified'
    and v_profile_type not in ('creator', 'organization')
  then
    raise exception 'Verified can only be awarded to creator or organization profiles.';
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

create or replace function public.revoke_user_badge(
  p_user_id uuid,
  p_badge_slug text
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
    raise exception 'Only administrators can revoke profile badges.';
  end if;

  if p_badge_slug = 'founding-500' then
    raise exception 'Founding 500 badges are controlled by Founding Member numbers.';
  end if;

  select b.id
  into v_badge_id
  from public.badges b
  where b.slug = p_badge_slug;

  if v_badge_id is null then
    return false;
  end if;

  delete from public.user_badges ub
  where ub.user_id = p_user_id
    and ub.badge_id = v_badge_id;

  return found;
end;
$$;

revoke all on function public.revoke_user_badge(uuid, text) from public;
grant execute on function public.revoke_user_badge(uuid, text) to authenticated;

create or replace function public.update_profile_type_and_metadata(
  p_user_id uuid,
  p_profile_type text,
  p_category text default null,
  p_subtype text default null,
  p_website_url text default null,
  p_primary_link_url text default null,
  p_primary_link_label text default null,
  p_social_links jsonb default '[]'::jsonb,
  p_public_contact_email text default null,
  p_public_contact_phone text default null,
  p_public_location text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_type text := lower(trim(coalesce(p_profile_type, '')));
  v_founding_number integer;
begin
  if auth.uid() is null or not public.is_admin_or_above() then
    raise exception 'Only administrators can manage profile type metadata.';
  end if;

  if v_profile_type not in ('member', 'creator', 'organization', 'system') then
    raise exception 'Invalid profile type.';
  end if;

  if coalesce(jsonb_typeof(p_social_links), 'array') <> 'array' then
    raise exception 'Social links must be a JSON array.';
  end if;

  select p.founding_member_number
  into v_founding_number
  from public.profiles p
  where p.id = p_user_id
    and coalesce(p.is_deleted, false) = false;

  if not found then
    raise exception 'Profile does not exist or is deleted.';
  end if;

  if v_profile_type in ('organization', 'system')
    and v_founding_number is not null
  then
    raise exception 'Profiles with Founding Member numbers can only be member or creator profiles.';
  end if;

  update public.profiles
  set profile_type = v_profile_type
  where id = p_user_id;

  if v_profile_type in ('creator', 'organization') then
    insert into public.profile_metadata (
      user_id,
      category,
      subtype,
      website_url,
      primary_link_url,
      primary_link_label,
      social_links,
      public_contact_email,
      public_contact_phone,
      public_location
    )
    values (
      p_user_id,
      nullif(trim(coalesce(p_category, '')), ''),
      nullif(trim(coalesce(p_subtype, '')), ''),
      nullif(trim(coalesce(p_website_url, '')), ''),
      nullif(trim(coalesce(p_primary_link_url, '')), ''),
      nullif(trim(coalesce(p_primary_link_label, '')), ''),
      coalesce(p_social_links, '[]'::jsonb),
      nullif(trim(coalesce(p_public_contact_email, '')), ''),
      nullif(trim(coalesce(p_public_contact_phone, '')), ''),
      nullif(trim(coalesce(p_public_location, '')), '')
    )
    on conflict (user_id) do update
    set
      category = excluded.category,
      subtype = excluded.subtype,
      website_url = excluded.website_url,
      primary_link_url = excluded.primary_link_url,
      primary_link_label = excluded.primary_link_label,
      social_links = excluded.social_links,
      public_contact_email = excluded.public_contact_email,
      public_contact_phone = excluded.public_contact_phone,
      public_location = excluded.public_location;
  else
    delete from public.profile_metadata
    where user_id = p_user_id;
  end if;

  return true;
end;
$$;

revoke all on function public.update_profile_type_and_metadata(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  text,
  text,
  text
) from public;
grant execute on function public.update_profile_type_and_metadata(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  text,
  text,
  text
) to authenticated;

comment on column public.profiles.profile_type is
  'Public profile classification. Separate from account_type, moderation roles, and profile badges.';

comment on table public.profile_metadata is
  'Public-safe creator and organization profile metadata. Sensitive private contact details do not belong here.';

comment on function public.get_public_profile_metadata(uuid[]) is
  'Returns public-safe profile type and creator/organization metadata for active profiles.';

comment on function public.update_profile_type_and_metadata(uuid, text, text, text, text, text, text, jsonb, text, text, text) is
  'Admin-only profile type and public metadata management.';

commit;
