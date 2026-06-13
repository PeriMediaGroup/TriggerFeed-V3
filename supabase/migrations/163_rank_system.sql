-- =========================================================
-- 163: Rank System V1
-- =========================================================

begin;

create table if not exists public.user_rank_thresholds (
  key text primary key,
  label text not null,
  min_posts integer not null,
  sort_order integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint user_rank_thresholds_min_posts_check
    check (min_posts >= 0)
);

create unique index if not exists user_rank_thresholds_sort_order_idx
on public.user_rank_thresholds(sort_order);

insert into public.user_rank_thresholds (key, label, min_posts, sort_order, is_active)
values
  ('FNG', 'FNG', 0, 10, true),
  ('range_regular', 'Range Regular', 5, 20, true),
  ('trailhand', 'Trailhand', 15, 30, true),
  ('camp_builder', 'Camp Builder', 30, 40, true),
  ('brass_stacker', 'Brass Stacker', 50, 50, true),
  ('gear_hound', 'Gear Hound', 75, 60, true),
  ('readiness_regular', 'Readiness Regular', 100, 70, true),
  ('signal_fire', 'Signal Fire', 150, 80, true),
  ('trail_boss', 'Trail Boss', 250, 90, true),
  ('brass_baron', 'Brass Baron', 500, 100, true)
on conflict (key) do update
set
  label = excluded.label,
  min_posts = excluded.min_posts,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

revoke all on public.user_rank_thresholds from anon;
revoke all on public.user_rank_thresholds from authenticated;
grant select on public.user_rank_thresholds to anon, authenticated;

alter table public.profiles
  add column if not exists last_seen_rank_key text references public.user_rank_thresholds(key) on delete set null,
  add column if not exists last_seen_rank_at timestamptz;

grant update (last_seen_rank_key, last_seen_rank_at)
on public.profiles
to authenticated;

create or replace function public.get_user_rank(p_user_id uuid)
returns table (
  user_id uuid,
  post_count integer,
  rank_key text,
  rank_label text,
  next_rank_key text,
  next_rank_label text,
  next_rank_min_posts integer,
  posts_until_next_rank integer
)
language sql
stable
security definer
set search_path = public
as $$
  with target_profile as (
    select p.id
    from public.profiles p
    where p.id = p_user_id
      and coalesce(p.is_deleted, false) = false
    limit 1
  ),
  counts as (
    select
      tp.id as user_id,
      count(posts.id)::integer as post_count
    from target_profile tp
    left join public.posts posts
      on posts.user_id = tp.id
     and coalesce(posts.is_deleted, false) = false
     and posts.visibility = 'public'
    group by tp.id
  ),
  current_rank as (
    select
      c.user_id,
      c.post_count,
      threshold.key,
      threshold.label,
      threshold.sort_order
    from counts c
    join lateral (
      select t.key, t.label, t.sort_order
      from public.user_rank_thresholds t
      where t.is_active = true
        and t.min_posts <= c.post_count
      order by t.min_posts desc, t.sort_order desc
      limit 1
    ) threshold on true
  ),
  next_rank as (
    select
      cr.user_id,
      threshold.key,
      threshold.label,
      threshold.min_posts
    from current_rank cr
    left join lateral (
      select t.key, t.label, t.min_posts
      from public.user_rank_thresholds t
      where t.is_active = true
        and t.min_posts > cr.post_count
      order by t.min_posts asc, t.sort_order asc
      limit 1
    ) threshold on true
  )
  select
    cr.user_id,
    cr.post_count,
    cr.key as rank_key,
    cr.label as rank_label,
    nr.key as next_rank_key,
    nr.label as next_rank_label,
    nr.min_posts as next_rank_min_posts,
    case
      when nr.min_posts is null then 0
      else greatest(nr.min_posts - cr.post_count, 0)
    end as posts_until_next_rank
  from current_rank cr
  left join next_rank nr
    on nr.user_id = cr.user_id;
$$;

revoke all on function public.get_user_rank(uuid) from public;
grant execute on function public.get_user_rank(uuid) to anon, authenticated;

drop function if exists public.get_my_profile();

create or replace function public.get_my_profile()
returns table (
  id uuid,
  email text,
  username text,
  first_name text,
  last_name text,
  display_name text,
  avatar_cloudinary_url text,
  banner_cloudinary_url text,
  profile_badge text,
  city text,
  state text,
  bio text,
  dob date,
  age_verified_at timestamptz,
  age_gate_version text,
  birthday_messages_enabled boolean,
  last_seen_rank_key text,
  last_seen_rank_at timestamptz,
  privacy_settings jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.email,
    p.username,
    p.first_name,
    p.last_name,
    p.display_name,
    p.avatar_cloudinary_url,
    p.banner_cloudinary_url,
    p.profile_badge,
    p.city,
    p.state,
    p.bio,
    p.dob,
    p.age_verified_at,
    p.age_gate_version,
    p.birthday_messages_enabled,
    p.last_seen_rank_key,
    p.last_seen_rank_at,
    p.privacy_settings,
    p.created_at,
    p.updated_at
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

revoke all on function public.get_my_profile() from public;
grant execute on function public.get_my_profile() to authenticated;

commit;
