begin;

-- ---------------------------------------------------------------------------
-- Profiles read grants after P1 lockdown
-- ---------------------------------------------------------------------------
-- The app filters/orders/searches on a few columns that were not included in the
-- first strict grant. PostgREST needs column privileges not just for returned
-- fields, but also for filters/order clauses.
--
-- Keep email out.
-- Keep direct normal access to dangerous admin fields limited.
-- ---------------------------------------------------------------------------

revoke select on table public.profiles from anon;
revoke select on table public.profiles from authenticated;

-- Public/logged-out safe profile reads.
grant select (
  id,
  username,
  username_lower,
  display_name,
  first_name,
  last_name,
  city,
  state,
  bio,
  avatar_cloudinary_url,
  banner_cloudinary_url,
  profile_badge,
  created_at,
  updated_at
) on public.profiles to anon;

-- Logged-in app reads.
-- Includes fields the app commonly needs for nav/profile/friends/admin UI checks.
-- Still excludes email.
grant select (
  id,
  username,
  username_lower,
  display_name,
  first_name,
  last_name,
  city,
  state,
  bio,
  avatar_cloudinary_url,
  avatar_cloudinary_public_id,
  banner_cloudinary_url,
  banner_cloudinary_public_id,
  profile_badge,
  role,
  privacy_settings,
  is_deleted,
  created_at,
  updated_at
) on public.profiles to authenticated;


-- ---------------------------------------------------------------------------
-- Vote count read grants
-- ---------------------------------------------------------------------------
-- Individual votes stay protected. Aggregate vote counts are safe to read.
-- ---------------------------------------------------------------------------

grant select on table public.post_vote_counts to anon, authenticated;


-- ---------------------------------------------------------------------------
-- Friend/profile related helpers/views, if they exist
-- ---------------------------------------------------------------------------
-- Defensive grants only if objects exist. Postgres: because one missing object
-- should not get to ruin everyone’s afternoon.
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.post_trending_view') is not null then
    grant select on table public.post_trending_view to anon, authenticated;
  end if;

  if to_regclass('public.post_scores') is not null then
    grant select on table public.post_scores to anon, authenticated;
  end if;
end $$;

commit;