-- Transactional admin profile conversion and explicit Founding number release.
-- No existing profiles, claims, or badges are changed by applying this migration.
begin;

alter table public.founding_member_numbers
  add column released_at timestamptz,
  add constraint founding_member_numbers_released_unclaimed_check
    check (released_at is null or profile_id is null);

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

  if public.is_founding_500_internal_profile(p_profile_id) then
    raise exception 'Internal company email accounts cannot receive Founding Member numbers';
  end if;

  -- During signup this BEFORE INSERT trigger runs before the profile is visible.
  -- Existing profiles must satisfy the same eligibility rules as the assignment trigger.
  if exists (select 1 from public.profiles p where p.id = p_profile_id
    and (p.account_type <> 'user' or p.profile_type not in ('member', 'creator'))) then
    raise exception 'Only member or creator user accounts can receive Founding Member numbers';
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
        and fmn.released_at is null
    ) then
      return p_requested_number;
    end if;

    update public.founding_member_numbers
    set profile_id = p_profile_id, assigned_at = now(), released_at = null
    where number = p_requested_number and released_at is not null;

    if not found then
      insert into public.founding_member_numbers (number, profile_id)
      values (p_requested_number, p_profile_id);
    end if;

    return p_requested_number;
  end if;

  -- Only explicitly released claims may be reused. Deleted profiles remain retired.
  select min(fmn.number) into v_number
  from public.founding_member_numbers fmn where fmn.released_at is not null;

  if v_number is not null then
    update public.founding_member_numbers
    set profile_id = p_profile_id, assigned_at = now(), released_at = null
    where number = v_number;
    return v_number;
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

revoke all on function public.claim_founding_member_number(uuid, integer) from public, anon, authenticated;

create or replace function public.set_profile_founding_member_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The sole exception to number immutability: an authorized organization conversion.
  -- The surrounding profile UPDATE and metadata RPC share this transaction.
  if tg_op = 'UPDATE'
    and old.profile_type in ('member', 'creator')
    and new.profile_type = 'organization'
    and old.founding_member_number is not null
    and (new.founding_member_number is null or new.founding_member_number = old.founding_member_number)
    and old.account_type = 'user' and new.account_type = 'user'
  then
    if auth.uid() is null or not public.is_admin_or_above() then
      raise exception 'Only administrators can release Founding Member numbers.' using errcode = '42501';
    end if;
    perform pg_advisory_xact_lock(hashtext('triggerfeed_founding_500'));
    update public.founding_member_numbers
    set profile_id = null, released_at = now()
    where number = old.founding_member_number and profile_id = old.id and released_at is null;
    if not found or exists (
      select 1 from public.founding_member_numbers where profile_id = old.id
    ) then
      raise exception 'Founding Member registry does not match this profile; review the claim before conversion.';
    end if;
    new.founding_member_number := null;
    return new;
  end if;

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
    and not public.is_founding_500_internal_email(new.email)
    and not public.is_founding_500_internal_profile(new.id)
    and public.is_founding_500_auto_assignment_enabled()
  then
    new.founding_member_number := public.claim_founding_member_number(new.id);
  elsif new.founding_member_number is not null
    and (
      tg_op = 'INSERT'
      or old.founding_member_number is null
    )
  then
    if public.is_founding_500_internal_email(new.email) then
      raise exception 'Internal company email accounts cannot receive Founding Member numbers';
    end if;
    perform public.claim_founding_member_number(
      new.id,
      new.founding_member_number
    );
  end if;

  return new;
end;
$$;

revoke all on function public.set_profile_founding_member_number() from public, anon, authenticated;

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
  if new.account_type = 'user' and new.profile_type in ('member', 'creator') and new.founding_member_number is not null then
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
  else
    delete from public.user_badges ub using public.badges b
    where ub.user_id = new.id and ub.badge_id = b.id and b.slug = 'founding-500';
  end if;

  return new;
end;
$$;

revoke all on function public.sync_founding_500_badge_assignment() from public, anon, authenticated;

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
  v_previous_type text;
  v_account_type text;
begin
  if auth.uid() is null or not public.is_admin_or_above() then
    raise exception 'Only administrators can manage profile type metadata.';
  end if;

  if v_profile_type not in ('member', 'creator', 'organization') then
    raise exception 'Invalid profile type.';
  end if;

  if coalesce(jsonb_typeof(p_social_links), 'array') <> 'array' then
    raise exception 'Social links must be a JSON array.';
  end if;

  select p.profile_type, p.account_type
  into v_previous_type, v_account_type
  from public.profiles p
  where p.id = p_user_id
    and coalesce(p.is_deleted, false) = false
  for update;

  if not found then
    raise exception 'Profile does not exist or is deleted.';
  end if;

  if v_account_type <> 'user' or v_previous_type = 'system' then
    raise exception 'System, editorial, and bot profiles cannot be converted through this operation.';
  end if;

  update public.profiles
  set profile_type = v_profile_type
  where id = p_user_id;

  -- Claim only after the new eligible type is stored: claim() checks the profile.
  -- No remembered number is restored, and disabled auto-assignment stays disabled.
  if v_previous_type = 'organization' and v_profile_type in ('member', 'creator')
    and public.is_founding_500_auto_assignment_enabled()
    and not public.is_founding_500_internal_profile(p_user_id)
  then
    update public.profiles
    set founding_member_number = public.claim_founding_member_number(p_user_id)
    where id = p_user_id and founding_member_number is null;
  end if;

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
) from public, anon, authenticated;
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


create or replace function public.get_founding_500_registry()
returns table (
  founding_member_number integer,
  status text,
  profile_id uuid,
  username text,
  display_name text,
  first_name text,
  last_name text,
  avatar_cloudinary_url text,
  profile_badge text,
  created_at timestamptz,
  assigned_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    fmn.number as founding_member_number,
    case
      when p.id is null then 'retired'
      else 'active'
    end as status,
    p.id as profile_id,
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
    p.created_at,
    fmn.assigned_at
  from public.founding_member_numbers fmn
  left join public.profiles p
    on p.id = fmn.profile_id
   and p.founding_member_number = fmn.number
   and p.account_type = 'user'
   and coalesce(p.is_deleted, false) = false
  where fmn.released_at is null
  order by fmn.number asc;
$$;

revoke all on function public.get_founding_500_registry() from public;
grant execute on function public.get_founding_500_registry() to anon, authenticated;

comment on function public.get_founding_500_registry() is
  'Public-safe Founding 500 registry. Active entries expose public profile-card fields; missing/deleted entries expose only retired status and number.';

drop function public.search_admin_users(text, integer);
create or replace function public.search_admin_users(
  p_query text default '',
  p_limit int default 50
)
returns table (
  id uuid,
  username text,
  display_name text,
  email text,
  avatar_cloudinary_url text,
  role text,
  is_muted boolean,
  is_banned boolean,
  is_deleted boolean,
  created_at timestamptz,
  account_type text,
  profile_type text,
  founding_member_number integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_query text := lower(nullif(trim(coalesce(p_query, '')), ''));
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_can_view_email boolean := public.is_admin_or_above();
begin
  if not v_can_view_email then
    raise exception 'Admin permission required';
  end if;

  return query
  select
    p.id,
    p.username,
    p.display_name,
    case when v_can_view_email then p.email else null end as email,
    p.avatar_cloudinary_url,
    p.role,
    coalesce(p.is_muted, false) as is_muted,
    coalesce(p.is_banned, false) as is_banned,
    coalesce(p.is_deleted, false) as is_deleted,
    p.created_at,
    p.account_type,
    p.profile_type,
    p.founding_member_number
  from public.profiles p
  where
    v_query is null
    or lower(coalesce(p.username, '')) like '%' || v_query || '%'
    or lower(coalesce(p.display_name, '')) like '%' || v_query || '%'
    or lower(coalesce(p.role, '')) = v_query
    or (
      v_query in ('muted', 'mute')
      and coalesce(p.is_muted, false) = true
    )
    or (
      v_query in ('banned', 'ban')
      and coalesce(p.is_banned, false) = true
    )
    or (
      v_query in ('deleted', 'removed')
      and coalesce(p.is_deleted, false) = true
    )
    or (
      v_query in ('active', 'enabled')
      and coalesce(p.is_muted, false) = false
      and coalesce(p.is_banned, false) = false
      and coalesce(p.is_deleted, false) = false
    )
    or (
      v_can_view_email
      and lower(coalesce(p.email, '')) like '%' || v_query || '%'
    )
  order by p.created_at desc
  limit v_limit;
end;
$$;

revoke all on function public.search_admin_users(text, int) from public, anon, authenticated;
grant execute on function public.search_admin_users(text, int) to authenticated;

comment on column public.founding_member_numbers.released_at is
  'Explicitly released by an admin organization conversion; reusable by normal claims. NULL includes active and retired claims.';
comment on table public.founding_member_numbers is
  'Founding 500 ledger. Deleted-profile claims remain retired; explicit organization-conversion releases are reusable.';
comment on column public.profiles.founding_member_number is
  'Founding 500 number retained across member/creator changes; released only on an authorized organization conversion.';
commit;
