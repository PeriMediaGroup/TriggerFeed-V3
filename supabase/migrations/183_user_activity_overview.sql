-- =========================================================
-- 183: User Activity Tracking and Admin Overview
-- =========================================================

begin;

create table if not exists public.user_activity (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_activity_last_seen_at_idx
on public.user_activity(last_seen_at desc);

alter table public.user_activity enable row level security;

drop policy if exists "Users can read own activity" on public.user_activity;
drop policy if exists "Users can insert own activity" on public.user_activity;
drop policy if exists "Users can update own activity" on public.user_activity;
drop policy if exists "Admins can read user activity" on public.user_activity;

create or replace function public.set_user_activity_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_user_activity_updated_at on public.user_activity;
create trigger set_user_activity_updated_at
before update on public.user_activity
for each row
execute function public.set_user_activity_updated_at();

create or replace function public.touch_user_activity()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.user_activity (user_id, last_seen_at)
  values (v_user_id, now())
  on conflict (user_id) do update
  set last_seen_at = excluded.last_seen_at
  where public.user_activity.last_seen_at < now() - interval '2 minutes';
end;
$$;

create or replace function public.get_admin_activity_overview(
  p_recent_limit integer default 10
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_recent_limit integer := least(greatest(coalesce(p_recent_limit, 10), 1), 50);
  v_online_now integer := 0;
  v_active_7_days integer := 0;
  v_new_7_days integer := 0;
  v_total_users integer := 0;
  v_recent_users jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_admin_or_above() then
    raise exception 'Admin permission required';
  end if;

  select count(*)::integer
  into v_online_now
  from public.user_activity ua
  join public.profiles p on p.id = ua.user_id
  where ua.last_seen_at >= now() - interval '10 minutes'
    and coalesce(p.is_deleted, false) = false;

  select count(*)::integer
  into v_active_7_days
  from public.user_activity ua
  join public.profiles p on p.id = ua.user_id
  where ua.last_seen_at >= now() - interval '7 days'
    and coalesce(p.is_deleted, false) = false;

  select count(*)::integer
  into v_new_7_days
  from public.profiles p
  where p.created_at >= now() - interval '7 days'
    and coalesce(p.is_deleted, false) = false;

  select count(*)::integer
  into v_total_users
  from public.profiles p
  where coalesce(p.is_deleted, false) = false;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', recent.user_id,
        'username', recent.username,
        'display_name', recent.display_name,
        'avatar_cloudinary_url', recent.avatar_cloudinary_url,
        'role', recent.role,
        'last_seen_at', recent.last_seen_at,
        'last_login_at', recent.last_login_at,
        'joined_at', recent.joined_at,
        'is_banned', recent.is_banned,
        'is_muted', recent.is_muted,
        'is_deleted', recent.is_deleted
      )
      order by recent.last_seen_at desc
    ),
    '[]'::jsonb
  )
  into v_recent_users
  from (
    select
      p.id as user_id,
      p.username,
      p.display_name,
      p.avatar_cloudinary_url,
      p.role,
      ua.last_seen_at,
      ua.last_login_at,
      p.created_at as joined_at,
      coalesce(p.is_banned, false) as is_banned,
      coalesce(p.is_muted, false) as is_muted,
      coalesce(p.is_deleted, false) as is_deleted
    from public.user_activity ua
    join public.profiles p on p.id = ua.user_id
    order by ua.last_seen_at desc
    limit v_recent_limit
  ) recent;

  return jsonb_build_object(
    'online_now', coalesce(v_online_now, 0),
    'active_7_days', coalesce(v_active_7_days, 0),
    'new_7_days', coalesce(v_new_7_days, 0),
    'total_users', coalesce(v_total_users, 0),
    'recent_users', coalesce(v_recent_users, '[]'::jsonb)
  );
end;
$$;

revoke all on table public.user_activity from public;
revoke all on function public.set_user_activity_updated_at() from public;
revoke all on function public.touch_user_activity() from public;
revoke all on function public.get_admin_activity_overview(integer) from public;

grant execute on function public.touch_user_activity() to authenticated;
grant execute on function public.get_admin_activity_overview(integer) to authenticated;

commit;
