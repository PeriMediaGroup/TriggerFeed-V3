-- Founding 500 production review.
-- Run after 20260913120000_founding_500_schema.sql is applied.
-- This script does not assign numbers.

begin;

select
  'configured_system_accounts' as review_section,
  p.id,
  p.email,
  p.username,
  p.display_name,
  p.account_type,
  p.founding_member_number,
  p.is_deleted,
  p.is_banned,
  p.created_at
from public.profiles p
where lower(coalesce(p.username, '')) in ('tf-one', 'tf-news')
order by lower(p.username);

select
  'already_numbered' as review_section,
  p.founding_member_number,
  p.id,
  p.email,
  p.username,
  p.display_name,
  p.account_type,
  p.is_deleted,
  p.is_banned,
  p.created_at
from public.profiles p
where p.founding_member_number is not null
order by p.founding_member_number;

select
  'eligible_human_candidates_chronological' as review_section,
  row_number() over (
    order by p.created_at asc, p.id asc
  ) as chronological_position_after_cleanup,
  p.id,
  p.email,
  p.username,
  p.display_name,
  p.first_name,
  p.last_name,
  p.account_type,
  p.is_deleted,
  p.is_banned,
  p.created_at
from public.profiles p
where p.account_type = 'user'
  and p.founding_member_number is null
  and coalesce(p.is_deleted, false) = false
  and coalesce(p.is_banned, false) = false
order by p.created_at asc, p.id asc;

select
  'likely_test_or_cleanup_candidates' as review_section,
  p.id,
  p.email,
  p.username,
  p.display_name,
  p.account_type,
  p.is_deleted,
  p.is_banned,
  p.created_at
from public.profiles p
where p.account_type = 'user'
  and p.founding_member_number is null
  and (
    coalesce(p.is_deleted, false) = true
    or coalesce(p.is_banned, false) = true
    or lower(coalesce(p.email, '')) like '%test%'
    or lower(coalesce(p.email, '')) like '%example.%'
    or lower(coalesce(p.username, '')) like 'test%'
    or lower(coalesce(p.username, '')) like '%test%'
    or lower(coalesce(p.display_name, '')) like '%test%'
  )
order by p.created_at asc, p.id asc;

rollback;
