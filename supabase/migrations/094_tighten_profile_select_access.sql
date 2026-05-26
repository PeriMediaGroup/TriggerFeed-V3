-- =========================================================
-- 094: Tighten profile SELECT access after broad grant in 091
-- =========================================================

begin;

revoke all privileges on table public.profiles from anon;
revoke all privileges on table public.profiles from authenticated;

grant select (
  id,
  username,
  username_lower,
  display_name,
  first_name,
  last_name,
  bio,
  avatar_cloudinary_url,
  banner_cloudinary_url,
  profile_badge,
  created_at,
  updated_at
) on public.profiles to anon;

grant select (
  id,
  username,
  username_lower,
  display_name,
  first_name,
  last_name,
  bio,
  avatar_cloudinary_url,
  banner_cloudinary_url,
  profile_badge,
  created_at,
  updated_at
) on public.profiles to authenticated;

grant insert (
  id,
  username,
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
  privacy_settings,
  created_at,
  updated_at
) on public.profiles to authenticated;

grant update (
  username,
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
  privacy_settings,
  updated_at
) on public.profiles to authenticated;

create or replace function public.get_my_profile()
returns table (
  id uuid,
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
    p.privacy_settings,
    p.created_at,
    p.updated_at
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

revoke all on function public.get_my_profile() from public;
grant execute on function public.get_my_profile() to authenticated;

create or replace function public.get_public_profile_cards(p_profile_ids uuid[])
returns table (
  id uuid,
  username text,
  display_name text,
  first_name text,
  last_name text,
  avatar_cloudinary_url text,
  profile_badge text,
  city text,
  state text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.username,
    p.display_name,
    p.first_name,
    p.last_name,
    p.avatar_cloudinary_url,
    p.profile_badge,
    case
      when case
        when lower(p.privacy_settings #>> '{profile_visibility,show_city}') in ('true', 'false')
          then (p.privacy_settings #>> '{profile_visibility,show_city}')::boolean
        else true
      end
        then p.city
      else null
    end as city,
    case
      when case
        when lower(p.privacy_settings #>> '{profile_visibility,show_state}') in ('true', 'false')
          then (p.privacy_settings #>> '{profile_visibility,show_state}')::boolean
        else true
      end
        then p.state
      else null
    end as state
  from public.profiles p
  where p.id = any(p_profile_ids)
    and coalesce(p.is_deleted, false) = false;
$$;

revoke all on function public.get_public_profile_cards(uuid[]) from public;
grant execute on function public.get_public_profile_cards(uuid[]) to anon, authenticated;

commit;
