-- Founding 500 historical backfill.
--
-- This migration assumes production profiles have been manually reviewed and
-- cleaned. It still refuses to assign any numbers unless Riot/Pete and Keri
-- resolve to exactly one eligible profile each.

begin;

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

do $$
declare
  v_eligible_count integer;
  v_riot_id uuid;
  v_keri_id uuid;
  v_riot_match_count integer;
  v_keri_match_count integer;
  v_assigned_count integer;
begin
  if exists (
    select 1
    from public.profiles p
    where lower(coalesce(p.username, '')) = lower('TF-One')
      and (
        p.account_type <> 'system'
        or p.founding_member_number is not null
      )
  ) then
    raise exception 'TF-One must be account_type=system and must not have a Founding Member number.';
  end if;

  if exists (
    select 1
    from public.profiles p
    where lower(coalesce(p.username, '')) = lower('TF-News')
      and (
        p.account_type <> 'editorial'
        or p.founding_member_number is not null
      )
  ) then
    raise exception 'TF-News must be account_type=editorial and must not have a Founding Member number.';
  end if;

  select count(*)::integer
  into v_eligible_count
  from public.profiles p
  where p.account_type = 'user'
    and coalesce(p.is_deleted, false) = false
    and coalesce(p.is_banned, false) = false;

  if v_eligible_count = 0 then
    raise notice 'No eligible user profiles found; skipping historical Founding 500 backfill.';
    return;
  end if;

  select count(*)::integer
  into v_riot_match_count
  from public.profiles p
  where p.account_type = 'user'
    and coalesce(p.is_deleted, false) = false
    and coalesce(p.is_banned, false) = false
    and (
      lower(coalesce(p.username, '')) in ('riot', 'pete')
      or lower(coalesce(p.display_name, '')) in ('riot', 'pete')
      or lower(coalesce(p.first_name, '')) = 'pete'
    );

  if v_riot_match_count <> 1 then
    raise exception
      'Could not safely resolve Riot/Pete profile for Founding Member #1. Match count: %',
      v_riot_match_count;
  end if;

  select p.id
  into strict v_riot_id
  from public.profiles p
  where p.account_type = 'user'
    and coalesce(p.is_deleted, false) = false
    and coalesce(p.is_banned, false) = false
    and (
      lower(coalesce(p.username, '')) in ('riot', 'pete')
      or lower(coalesce(p.display_name, '')) in ('riot', 'pete')
      or lower(coalesce(p.first_name, '')) = 'pete'
    );

  select count(*)::integer
  into v_keri_match_count
  from public.profiles p
  where p.account_type = 'user'
    and coalesce(p.is_deleted, false) = false
    and coalesce(p.is_banned, false) = false
    and (
      lower(coalesce(p.username, '')) = 'keri'
      or lower(coalesce(p.display_name, '')) = 'keri'
      or lower(coalesce(p.first_name, '')) = 'keri'
    );

  if v_keri_match_count <> 1 then
    raise exception
      'Could not safely resolve Keri profile for Founding Member #2. Match count: %',
      v_keri_match_count;
  end if;

  select p.id
  into strict v_keri_id
  from public.profiles p
  where p.account_type = 'user'
    and coalesce(p.is_deleted, false) = false
    and coalesce(p.is_banned, false) = false
    and (
      lower(coalesce(p.username, '')) = 'keri'
      or lower(coalesce(p.display_name, '')) = 'keri'
      or lower(coalesce(p.first_name, '')) = 'keri'
    );

  if v_riot_id = v_keri_id then
    raise exception 'Riot/Pete and Keri resolved to the same profile.';
  end if;

  if exists (
    select 1
    from public.profiles p
    where p.founding_member_number is not null
      and (
        (p.id = v_riot_id and p.founding_member_number <> 1)
        or (p.id = v_keri_id and p.founding_member_number <> 2)
        or (p.id not in (v_riot_id, v_keri_id))
      )
  ) then
    raise exception 'Existing Founding Member numbers conflict with the historical backfill.';
  end if;

  update public.profiles
  set founding_member_number = 1
  where id = v_riot_id
    and founding_member_number is null;

  update public.profiles
  set founding_member_number = 2
  where id = v_keri_id
    and founding_member_number is null;

  with ordered_remaining as (
    select
      p.id,
      row_number() over (order by p.created_at asc, p.id asc) + 2 as next_number
    from public.profiles p
    where p.account_type = 'user'
      and coalesce(p.is_deleted, false) = false
      and coalesce(p.is_banned, false) = false
      and p.id not in (v_riot_id, v_keri_id)
      and p.founding_member_number is null
  )
  update public.profiles p
  set founding_member_number = ordered_remaining.next_number
  from ordered_remaining
  where p.id = ordered_remaining.id
    and ordered_remaining.next_number <= 500;

  update public.founding_500_settings
  set is_auto_assignment_enabled = true
  where singleton = true;

  select count(*)::integer
  into v_assigned_count
  from public.profiles p
  where p.founding_member_number is not null;

  raise notice 'Founding 500 historical backfill assigned % profile(s). Auto-assignment is now enabled.',
    v_assigned_count;
end $$;

commit;
