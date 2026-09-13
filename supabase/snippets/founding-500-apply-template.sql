-- Founding 500 reviewed historical numbering template.
--
-- Do not run this file as-is. Replace the rows in reviewed_founding_members
-- with the exact reviewed production profile IDs and permanent numbers.
--
-- Required ordering:
--   1  Riot / Pete
--   2  Keri
--   3+ Remaining legitimate human users ordered by original created_at
--
-- This script enables automatic assignment only after reviewed historical
-- members are assigned.

begin;

create temp table reviewed_founding_members (
  founding_member_number integer primary key,
  profile_id uuid not null unique,
  review_note text not null
) on commit drop;

insert into reviewed_founding_members (
  founding_member_number,
  profile_id,
  review_note
)
values
  (1, '00000000-0000-0000-0000-000000000000'::uuid, 'REPLACE_WITH_RIOT_OR_PETE_PROFILE_ID'),
  (2, '00000000-0000-0000-0000-000000000001'::uuid, 'REPLACE_WITH_KERI_PROFILE_ID');

do $$
begin
  if exists (
    select 1
    from reviewed_founding_members rfm
    where rfm.profile_id in (
        '00000000-0000-0000-0000-000000000000'::uuid,
        '00000000-0000-0000-0000-000000000001'::uuid
      )
      or rfm.review_note like 'REPLACE_WITH_%'
  ) then
    raise exception 'Replace placeholder profile IDs and review notes before applying Founding 500 numbering.';
  end if;

  if not exists (
    select 1
    from reviewed_founding_members rfm
    where rfm.founding_member_number = 1
  ) then
    raise exception 'Founding Member #1 must be explicitly reviewed and included.';
  end if;

  if not exists (
    select 1
    from reviewed_founding_members rfm
    where rfm.founding_member_number = 2
  ) then
    raise exception 'Founding Member #2 must be explicitly reviewed and included.';
  end if;

  if exists (
    select 1
    from reviewed_founding_members rfm
    where rfm.founding_member_number < 1
      or rfm.founding_member_number > 500
  ) then
    raise exception 'Founding Member numbers must be between 1 and 500.';
  end if;

  if exists (
    select 1
    from (
      select
        rfm.founding_member_number,
        row_number() over (order by rfm.founding_member_number) as expected_number
      from reviewed_founding_members rfm
    ) numbered
    where numbered.founding_member_number <> numbered.expected_number
  ) then
    raise exception 'Reviewed Founding Member numbers must be contiguous from 1 with no gaps.';
  end if;

  if exists (
    select 1
    from reviewed_founding_members rfm
    left join public.profiles p on p.id = rfm.profile_id
    where p.id is null
      or p.account_type <> 'user'
      or coalesce(p.is_deleted, false) = true
      or coalesce(p.is_banned, false) = true
  ) then
    raise exception 'Every reviewed Founding 500 profile must exist, be account_type=user, and not be deleted or banned.';
  end if;

  if exists (
    select 1
    from reviewed_founding_members rfm
    join public.profiles p on p.id = rfm.profile_id
    where p.founding_member_number is not null
      and p.founding_member_number <> rfm.founding_member_number
  ) then
    raise exception 'A reviewed profile already has a different Founding Member number.';
  end if;
end $$;

select
  rfm.founding_member_number,
  p.id,
  p.email,
  p.username,
  p.display_name,
  p.created_at,
  rfm.review_note
from reviewed_founding_members rfm
join public.profiles p on p.id = rfm.profile_id
order by rfm.founding_member_number;

update public.profiles p
set founding_member_number = rfm.founding_member_number
from reviewed_founding_members rfm
where p.id = rfm.profile_id
  and p.founding_member_number is null;

update public.founding_500_settings
set is_auto_assignment_enabled = true
where singleton = true;

select
  public.is_founding_500_auto_assignment_enabled() as auto_assignment_enabled,
  count(*) filter (where founding_member_number is not null) as numbered_profiles,
  min(founding_member_number) as first_number,
  max(founding_member_number) as last_number
from public.profiles;

commit;
