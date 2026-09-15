-- =========================================================
-- Marketing Attribution Dashboard Reporting
-- =========================================================

begin;

create or replace function public.get_marketing_attribution_totals(
  p_start_at timestamptz default null,
  p_end_at timestamptz default null
)
returns table (
  visits bigint,
  unique_visitors bigint,
  registrations bigint,
  first_visit_at timestamptz,
  last_visit_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin_or_above() then
    raise exception 'Admin permission required';
  end if;

  return query
  select
    count(mv.id) as visits,
    count(distinct mv.visitor_id) as unique_visitors,
    count(distinct mv.converted_user_id) filter (where mv.converted_user_id is not null) as registrations,
    min(mv.created_at) as first_visit_at,
    max(mv.created_at) as last_visit_at
  from public.marketing_visits mv
  where (p_start_at is null or mv.created_at >= p_start_at)
    and (p_end_at is null or mv.created_at < p_end_at);
end;
$$;

revoke all on function public.get_marketing_attribution_totals(timestamptz, timestamptz) from public;
grant execute on function public.get_marketing_attribution_totals(timestamptz, timestamptz) to authenticated;

create or replace function public.get_marketing_device_breakdown(
  p_start_at timestamptz default null,
  p_end_at timestamptz default null
)
returns table (
  device_category text,
  visits bigint,
  unique_visitors bigint,
  registrations bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin_or_above() then
    raise exception 'Admin permission required';
  end if;

  return query
  select
    coalesce(mv.device_category, 'unknown') as device_category,
    count(mv.id) as visits,
    count(distinct mv.visitor_id) as unique_visitors,
    count(distinct mv.converted_user_id) filter (where mv.converted_user_id is not null) as registrations
  from public.marketing_visits mv
  where (p_start_at is null or mv.created_at >= p_start_at)
    and (p_end_at is null or mv.created_at < p_end_at)
  group by coalesce(mv.device_category, 'unknown')
  order by visits desc, device_category;
end;
$$;

revoke all on function public.get_marketing_device_breakdown(timestamptz, timestamptz) from public;
grant execute on function public.get_marketing_device_breakdown(timestamptz, timestamptz) to authenticated;

comment on function public.get_marketing_attribution_totals(timestamptz, timestamptz) is
  'Admin-only aggregate totals for the marketing attribution dashboard.';

comment on function public.get_marketing_device_breakdown(timestamptz, timestamptz) is
  'Admin-only device-category breakdown for the marketing attribution dashboard.';

commit;
