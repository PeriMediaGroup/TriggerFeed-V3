-- External acquisition must not include internal ad delivery traffic.
-- Keep historical rows intact; filter reporting instead of deleting visitor history.
begin;

create or replace function public.is_internal_ad_attribution(p_source text, p_landing_path text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(public.normalize_marketing_attribution_slug(p_source) = 'triggerfeed', false)
    or split_part(split_part(coalesce(p_landing_path, ''), '#', 1), '?', 2)
      ~* '(^|&)utm_medium=in-feed-ad(&|$)';
$$;
revoke all on function public.is_internal_ad_attribution(text, text) from public, anon, authenticated;

create or replace function public.record_marketing_attribution_visit(
  p_visitor_id uuid,
  p_source text default null,
  p_campaign text default null,
  p_landing_path text default null,
  p_referrer_host text default null,
  p_device_category text default 'unknown',
  p_platform text default 'web'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_id uuid;
  v_campaign_id uuid;
  v_visit_id uuid;
  v_landing_path text := left(nullif(trim(coalesce(p_landing_path, '')), ''), 500);
  v_referrer_host text := left(nullif(lower(trim(coalesce(p_referrer_host, ''))), ''), 255);
  v_device_category text := lower(trim(coalesce(p_device_category, 'unknown')));
  v_platform text := lower(trim(coalesce(p_platform, 'web')));
begin
  -- Check the original path before the existing 500-character storage limit.
  if public.is_internal_ad_attribution(p_source, p_landing_path) then
    return null;
  end if;

  if p_visitor_id is null then
    raise exception 'visitor_id is required';
  end if;

  if v_device_category not in ('mobile', 'desktop', 'tablet', 'unknown') then
    v_device_category := 'unknown';
  end if;

  if v_platform not in ('web', 'android') then
    v_platform := 'web';
  end if;

  v_source_id := public.get_or_create_marketing_source(p_source);
  v_campaign_id := public.get_or_create_marketing_campaign(v_source_id, p_campaign);

  insert into public.marketing_visitors (
    id,
    first_source_id,
    first_campaign_id,
    first_landing_path,
    platform
  )
  values (
    p_visitor_id,
    v_source_id,
    v_campaign_id,
    v_landing_path,
    v_platform
  )
  on conflict (id) do update
  set
    first_source_id = coalesce(public.marketing_visitors.first_source_id, excluded.first_source_id),
    first_campaign_id = coalesce(public.marketing_visitors.first_campaign_id, excluded.first_campaign_id),
    first_landing_path = coalesce(public.marketing_visitors.first_landing_path, excluded.first_landing_path),
    last_seen_at = now(),
    platform = coalesce(nullif(public.marketing_visitors.platform, ''), excluded.platform);

  insert into public.marketing_visits (
    visitor_id,
    source_id,
    campaign_id,
    landing_path,
    referrer_host,
    device_category,
    platform
  )
  values (
    p_visitor_id,
    v_source_id,
    v_campaign_id,
    v_landing_path,
    v_referrer_host,
    v_device_category,
    v_platform
  )
  returning id into v_visit_id;

  return v_visit_id;
end;
$$;

revoke all on function public.record_marketing_attribution_visit(uuid, text, text, text, text, text, text) from public;
grant execute on function public.record_marketing_attribution_visit(uuid, text, text, text, text, text, text) to anon, authenticated;

create or replace function public.get_marketing_attribution_summary(
  p_start_at timestamptz default null,
  p_end_at timestamptz default null
)
returns table (
  source text,
  campaign text,
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
    coalesce(ms.slug, 'unknown') as source,
    mc.slug as campaign,
    count(mv.id) as visits,
    count(distinct mv.visitor_id) as unique_visitors,
    count(distinct mv.converted_user_id) filter (where mv.converted_user_id is not null) as registrations,
    min(mv.created_at) as first_visit_at,
    max(mv.created_at) as last_visit_at
  from public.marketing_visits mv
  left join public.marketing_sources ms
    on ms.id = mv.source_id
  left join public.marketing_campaigns mc
    on mc.id = mv.campaign_id
  where not public.is_internal_ad_attribution(ms.slug, mv.landing_path)
    and (p_start_at is null or mv.created_at >= p_start_at)
    and (p_end_at is null or mv.created_at < p_end_at)
  group by ms.slug, mc.slug
  order by visits desc, source, campaign;
end;
$$;

revoke all on function public.get_marketing_attribution_summary(timestamptz, timestamptz) from public;
grant execute on function public.get_marketing_attribution_summary(timestamptz, timestamptz) to authenticated;

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
  left join public.marketing_sources ms on ms.id = mv.source_id
  where not public.is_internal_ad_attribution(ms.slug, mv.landing_path)
    and (p_start_at is null or mv.created_at >= p_start_at)
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
  left join public.marketing_sources ms on ms.id = mv.source_id
  where not public.is_internal_ad_attribution(ms.slug, mv.landing_path)
    and (p_start_at is null or mv.created_at >= p_start_at)
    and (p_end_at is null or mv.created_at < p_end_at)
  group by coalesce(mv.device_category, 'unknown')
  order by visits desc, device_category;
end;
$$;

revoke all on function public.get_marketing_device_breakdown(timestamptz, timestamptz) from public;
grant execute on function public.get_marketing_device_breakdown(timestamptz, timestamptz) to authenticated;

commit;
