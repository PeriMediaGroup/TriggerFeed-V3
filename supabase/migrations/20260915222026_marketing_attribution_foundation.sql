-- =========================================================
-- Marketing Attribution Foundation
-- =========================================================

begin;

create table if not exists public.marketing_sources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_sources_slug_check
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80)
);

create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.marketing_sources(id) on delete cascade,
  slug text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_campaigns_slug_check
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  constraint marketing_campaigns_source_slug_key unique (source_id, slug)
);

create table if not exists public.marketing_visitors (
  id uuid primary key,
  first_source_id uuid references public.marketing_sources(id) on delete set null,
  first_campaign_id uuid references public.marketing_campaigns(id) on delete set null,
  first_landing_path text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  converted_user_id uuid references public.profiles(id) on delete set null,
  converted_at timestamptz,
  platform text not null default 'web',
  constraint marketing_visitors_platform_check
    check (platform in ('web', 'android')),
  constraint marketing_visitors_landing_path_length_check
    check (first_landing_path is null or char_length(first_landing_path) <= 500)
);

create table if not exists public.marketing_visits (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null references public.marketing_visitors(id) on delete cascade,
  source_id uuid references public.marketing_sources(id) on delete set null,
  campaign_id uuid references public.marketing_campaigns(id) on delete set null,
  landing_path text,
  referrer_host text,
  device_category text not null default 'unknown',
  platform text not null default 'web',
  converted_user_id uuid references public.profiles(id) on delete set null,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint marketing_visits_device_category_check
    check (device_category in ('mobile', 'desktop', 'tablet', 'unknown')),
  constraint marketing_visits_platform_check
    check (platform in ('web', 'android')),
  constraint marketing_visits_landing_path_length_check
    check (landing_path is null or char_length(landing_path) <= 500),
  constraint marketing_visits_referrer_host_length_check
    check (referrer_host is null or char_length(referrer_host) <= 255)
);

create index if not exists marketing_sources_slug_idx
on public.marketing_sources(slug);

create index if not exists marketing_campaigns_source_id_slug_idx
on public.marketing_campaigns(source_id, slug);

create index if not exists marketing_visitors_first_source_id_idx
on public.marketing_visitors(first_source_id);

create index if not exists marketing_visitors_first_campaign_id_idx
on public.marketing_visitors(first_campaign_id);

create index if not exists marketing_visitors_first_seen_at_idx
on public.marketing_visitors(first_seen_at desc);

create index if not exists marketing_visitors_converted_user_id_idx
on public.marketing_visitors(converted_user_id);

create index if not exists marketing_visits_visitor_id_idx
on public.marketing_visits(visitor_id);

create index if not exists marketing_visits_source_id_created_at_idx
on public.marketing_visits(source_id, created_at desc);

create index if not exists marketing_visits_campaign_id_created_at_idx
on public.marketing_visits(campaign_id, created_at desc);

create index if not exists marketing_visits_created_at_idx
on public.marketing_visits(created_at desc);

create index if not exists marketing_visits_converted_user_id_idx
on public.marketing_visits(converted_user_id);

alter table public.marketing_sources enable row level security;
alter table public.marketing_campaigns enable row level security;
alter table public.marketing_visitors enable row level security;
alter table public.marketing_visits enable row level security;

revoke all on table public.marketing_sources from public, anon, authenticated;
revoke all on table public.marketing_campaigns from public, anon, authenticated;
revoke all on table public.marketing_visitors from public, anon, authenticated;
revoke all on table public.marketing_visits from public, anon, authenticated;

grant select on table public.marketing_sources to authenticated;
grant select on table public.marketing_campaigns to authenticated;
grant select on table public.marketing_visitors to authenticated;
grant select on table public.marketing_visits to authenticated;

drop policy if exists "marketing_sources_admin_select" on public.marketing_sources;
create policy "marketing_sources_admin_select"
on public.marketing_sources
for select
to authenticated
using (public.is_admin_or_above());

drop policy if exists "marketing_campaigns_admin_select" on public.marketing_campaigns;
create policy "marketing_campaigns_admin_select"
on public.marketing_campaigns
for select
to authenticated
using (public.is_admin_or_above());

drop policy if exists "marketing_visitors_admin_select" on public.marketing_visitors;
create policy "marketing_visitors_admin_select"
on public.marketing_visitors
for select
to authenticated
using (public.is_admin_or_above());

drop policy if exists "marketing_visits_admin_select" on public.marketing_visits;
create policy "marketing_visits_admin_select"
on public.marketing_visits
for select
to authenticated
using (public.is_admin_or_above());

create or replace function public.normalize_marketing_attribution_slug(p_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_value is null then null
    else nullif(
      regexp_replace(
        regexp_replace(
          regexp_replace(lower(trim(p_value)), '[\s_]+', '-', 'g'),
          '[^a-z0-9-]+',
          '',
          'g'
        ),
        '(^-+|-+$)',
        '',
        'g'
      ),
      ''
    )
  end;
$$;

revoke all on function public.normalize_marketing_attribution_slug(text) from public;

create or replace function public.get_or_create_marketing_source(p_source text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source text := public.normalize_marketing_attribution_slug(p_source);
  v_source_id uuid;
begin
  if v_source is null or char_length(v_source) > 80 or v_source !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    return null;
  end if;

  insert into public.marketing_sources (slug)
  values (v_source)
  on conflict (slug) do update
  set updated_at = now()
  returning id into v_source_id;

  return v_source_id;
end;
$$;

revoke all on function public.get_or_create_marketing_source(text) from public;

create or replace function public.get_or_create_marketing_campaign(
  p_source_id uuid,
  p_campaign text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign text := public.normalize_marketing_attribution_slug(p_campaign);
  v_campaign_id uuid;
begin
  if p_source_id is null then
    return null;
  end if;

  if v_campaign is null or char_length(v_campaign) > 80 or v_campaign !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    return null;
  end if;

  insert into public.marketing_campaigns (source_id, slug)
  values (p_source_id, v_campaign)
  on conflict (source_id, slug) do update
  set updated_at = now()
  returning id into v_campaign_id;

  return v_campaign_id;
end;
$$;

revoke all on function public.get_or_create_marketing_campaign(uuid, text) from public;

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

create or replace function public.associate_marketing_visitor_with_user(
  p_visitor_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_visitor_id is null or p_user_id is null then
    return false;
  end if;

  update public.marketing_visitors
  set
    converted_user_id = coalesce(converted_user_id, p_user_id),
    converted_at = coalesce(converted_at, now())
  where id = p_visitor_id;

  update public.marketing_visits
  set
    converted_user_id = coalesce(converted_user_id, p_user_id),
    converted_at = coalesce(converted_at, now())
  where visitor_id = p_visitor_id
    and converted_user_id is null;

  return found;
end;
$$;

revoke all on function public.associate_marketing_visitor_with_user(uuid, uuid) from public;

create or replace function public.associate_my_marketing_attribution(p_visitor_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  return public.associate_marketing_visitor_with_user(p_visitor_id, auth.uid());
end;
$$;

revoke all on function public.associate_my_marketing_attribution(uuid) from public;
grant execute on function public.associate_my_marketing_attribution(uuid) to authenticated;

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
  where (p_start_at is null or mv.created_at >= p_start_at)
    and (p_end_at is null or mv.created_at < p_end_at)
  group by ms.slug, mc.slug
  order by visits desc, source, campaign;
end;
$$;

revoke all on function public.get_marketing_attribution_summary(timestamptz, timestamptz) from public;
grant execute on function public.get_marketing_attribution_summary(timestamptz, timestamptz) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dob date;
  v_age_gate_version text;
  v_birthday_messages_enabled boolean;
  v_marketing_visitor_id uuid;
begin
  begin
    if new.raw_user_meta_data ? 'dob'
      and (new.raw_user_meta_data->>'dob') ~ '^\d{4}-\d{2}-\d{2}$'
    then
      v_dob := (new.raw_user_meta_data->>'dob')::date;
    end if;
  exception
    when others then
      v_dob := null;
  end;

  begin
    if new.raw_user_meta_data ? 'marketing_visitor_id'
      and (new.raw_user_meta_data->>'marketing_visitor_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then
      v_marketing_visitor_id := (new.raw_user_meta_data->>'marketing_visitor_id')::uuid;
    end if;
  exception
    when others then
      v_marketing_visitor_id := null;
  end;

  v_age_gate_version := nullif(trim(coalesce(new.raw_user_meta_data->>'age_gate_version', '')), '');
  v_birthday_messages_enabled := coalesce(
    case
      when lower(coalesce(new.raw_user_meta_data->>'birthday_messages_enabled', '')) in ('true', 't', '1', 'yes')
        then true
      when lower(coalesce(new.raw_user_meta_data->>'birthday_messages_enabled', '')) in ('false', 'f', '0', 'no')
        then false
      else null
    end,
    true
  );

  insert into public.profiles (
    id,
    email,
    username,
    display_name,
    first_name,
    last_name,
    dob,
    age_verified_at,
    age_gate_version,
    birthday_messages_enabled,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data->>'username', ''),
    nullif(new.raw_user_meta_data->>'display_name', ''),
    nullif(new.raw_user_meta_data->>'first_name', ''),
    nullif(new.raw_user_meta_data->>'last_name', ''),
    case when public.is_adult_dob(v_dob) then v_dob else null end,
    case when public.is_adult_dob(v_dob) then now() else null end,
    coalesce(v_age_gate_version, 'v1'),
    v_birthday_messages_enabled,
    now(),
    now()
  )
  on conflict (id) do update
  set
    email = excluded.email,
    dob = coalesce(public.profiles.dob, excluded.dob),
    age_verified_at = coalesce(public.profiles.age_verified_at, excluded.age_verified_at),
    age_gate_version = coalesce(nullif(public.profiles.age_gate_version, ''), excluded.age_gate_version, 'v1'),
    birthday_messages_enabled = coalesce(public.profiles.birthday_messages_enabled, excluded.birthday_messages_enabled, true),
    updated_at = now();

  perform public.record_user_referral_from_code(
    new.id,
    new.raw_user_meta_data->>'referral_code'
  );

  begin
    perform public.associate_marketing_visitor_with_user(
      v_marketing_visitor_id,
      new.id
    );
  exception
    when others then
      raise warning 'Marketing attribution association failed for user %: %',
        new.id,
        sqlerrm;
  end;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;

comment on table public.marketing_sources is
  'Normalized marketing acquisition sources such as sawmill or greenville-gun-show.';

comment on table public.marketing_campaigns is
  'Normalized marketing campaign labels scoped to a source, such as sticker or business-card.';

comment on table public.marketing_visitors is
  'Anonymous visitor attribution state. Visitor ids are random UUIDs generated client-side, not fingerprints.';

comment on table public.marketing_visits is
  'Attribution visits/events captured from source/campaign URLs for later conversion reporting.';

commit;
