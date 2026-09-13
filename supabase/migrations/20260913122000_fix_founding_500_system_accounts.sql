-- One-time repair for Founding 500 classification/backfill.
-- Fixes TF_One / TF_News usernames that were missed by the original
-- TF-One / TF-News username checks, then rebuilds the initial numbering.
--
-- Safe intent:
--   Riot = #1
--   Keri = #2
--   system/editorial/bot accounts = no number
--   all other eligible human users = chronological order
--   ledger rebuilt to match the corrected initial assignment
--
-- This migration is intended only as a corrective follow-up immediately
-- after the initial historical backfill.

begin;

-- Stop new automatic claims while the historical assignment is repaired.
update public.founding_500_settings
set is_auto_assignment_enabled = false
where singleton = true;

-- The existing trigger correctly makes numbers immutable. Temporarily
-- disable it for this controlled one-time repair.
alter table public.profiles
  disable trigger set_profile_founding_member_number_trigger;

-- Clear the current profile assignments first. This also allows account_type
-- to be corrected without violating profiles_founding_member_requires_user_check.
update public.profiles
set founding_member_number = null
where founding_member_number is not null;

-- Correct the two TriggerFeed-owned identities. Match both username and
-- display-name forms so underscore/hyphen differences cannot miss them again.
update public.profiles
set account_type = 'system'
where (
    lower(coalesce(username, '')) in ('tf_one', 'tf-one', 'tfone')
    or lower(coalesce(display_name, '')) in ('tf_one', 'tf-one', 'tfone')
  );

update public.profiles
set account_type = 'editorial'
where (
    lower(coalesce(username, '')) in ('tf_news', 'tf-news', 'tfnews')
    or lower(coalesce(display_name, '')) in ('tf_news', 'tf-news', 'tfnews')
  );

do $$
declare
  v_riot_id uuid;
  v_keri_id uuid;
  v_riot_match_count integer;
  v_keri_match_count integer;
  v_assigned_count integer;
begin
  -- Resolve Riot/Pete safely.
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

  -- Resolve Keri safely.
  select count(*)::integer
  into v_keri_match_count
  from public.profiles p
  where p.account_type = 'user'
    and coalesce(p.is_deleted, false) = false
    and coalesce(p.is_banned, false) = false
    and (
      lower(coalesce(p.username, '')) in ('keri', 'keri_beri', 'keri-beri')
      or lower(coalesce(p.display_name, '')) in ('keri', 'keri_beri', 'keri-beri')
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
      lower(coalesce(p.username, '')) in ('keri', 'keri_beri', 'keri-beri')
      or lower(coalesce(p.display_name, '')) in ('keri', 'keri_beri', 'keri-beri')
      or lower(coalesce(p.first_name, '')) = 'keri'
    );

  if v_riot_id = v_keri_id then
    raise exception 'Riot/Pete and Keri resolved to the same profile.';
  end if;

  -- This ledger currently contains only the just-created historical backfill.
  -- Rebuild it so the erroneous TF-owned assignments do not permanently burn
  -- #5 / #25 and the corrected historical sequence has no artificial gaps.
  delete from public.founding_member_numbers;

  -- Assign the two fixed historical positions.
  update public.profiles
  set founding_member_number = 1
  where id = v_riot_id;

  update public.profiles
  set founding_member_number = 2
  where id = v_keri_id;

  insert into public.founding_member_numbers (number, profile_id)
  values
    (1, v_riot_id),
    (2, v_keri_id);

  -- Number remaining legitimate human users chronologically.
  with ordered_remaining as (
    select
      p.id,
      row_number() over (order by p.created_at asc, p.id asc) + 2 as next_number
    from public.profiles p
    where p.account_type = 'user'
      and coalesce(p.is_deleted, false) = false
      and coalesce(p.is_banned, false) = false
      and p.id not in (v_riot_id, v_keri_id)
  ),
  assigned as (
    update public.profiles p
    set founding_member_number = ordered_remaining.next_number
    from ordered_remaining
    where p.id = ordered_remaining.id
      and ordered_remaining.next_number <= 500
    returning p.id, p.founding_member_number
  )
  insert into public.founding_member_numbers (number, profile_id)
  select a.founding_member_number, a.id
  from assigned a
  order by a.founding_member_number;

  -- Sanity-check TriggerFeed-owned identities.
  if exists (
    select 1
    from public.profiles p
    where (
        lower(coalesce(p.username, '')) in ('tf_one', 'tf-one', 'tfone')
        or lower(coalesce(p.display_name, '')) in ('tf_one', 'tf-one', 'tfone')
      )
      and (
        p.account_type <> 'system'
        or p.founding_member_number is not null
      )
  ) then
    raise exception 'TF-One/TF_One repair failed.';
  end if;

  if exists (
    select 1
    from public.profiles p
    where (
        lower(coalesce(p.username, '')) in ('tf_news', 'tf-news', 'tfnews')
        or lower(coalesce(p.display_name, '')) in ('tf_news', 'tf-news', 'tfnews')
      )
      and (
        p.account_type <> 'editorial'
        or p.founding_member_number is not null
      )
  ) then
    raise exception 'TF-News/TF_News repair failed.';
  end if;

  select count(*)::integer
  into v_assigned_count
  from public.profiles p
  where p.founding_member_number is not null;

  raise notice
    'Founding 500 repair completed. Corrected historical assignment contains % profile(s).',
    v_assigned_count;
end $$;

-- Restore normal protection before auto-assignment comes back online.
alter table public.profiles
  enable trigger set_profile_founding_member_number_trigger;

update public.founding_500_settings
set is_auto_assignment_enabled = true
where singleton = true;

commit;
