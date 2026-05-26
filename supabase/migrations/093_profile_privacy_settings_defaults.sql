-- =========================================================
-- 093: Profile privacy settings defaults
-- =========================================================

begin;

alter table public.profiles
alter column privacy_settings
set default '{
  "profile_visibility": {
    "show_city": true,
    "show_state": true,
    "show_email": false
  }
}'::jsonb;

update public.profiles
set privacy_settings = jsonb_build_object(
  'profile_visibility',
  jsonb_build_object(
    'show_city',
    case
      when lower(privacy_settings #>> '{profile_visibility,show_city}') in ('true', 'false')
        then (privacy_settings #>> '{profile_visibility,show_city}')::boolean
      else true
    end,
    'show_state',
    case
      when lower(privacy_settings #>> '{profile_visibility,show_state}') in ('true', 'false')
        then (privacy_settings #>> '{profile_visibility,show_state}')::boolean
      else true
    end,
    'show_email',
    case
      when lower(privacy_settings #>> '{profile_visibility,show_email}') in ('true', 'false')
        then (privacy_settings #>> '{profile_visibility,show_email}')::boolean
      else false
    end
  )
);

create or replace function public.get_public_profile(p_profile_id uuid)
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
    end as state,
    p.bio,
    p.created_at,
    p.updated_at
  from public.profiles p
  where p.id = p_profile_id
    and coalesce(p.is_deleted, false) = false
  limit 1;
$$;

revoke all on function public.get_public_profile(uuid) from public;
grant execute on function public.get_public_profile(uuid) to anon, authenticated;

commit;
