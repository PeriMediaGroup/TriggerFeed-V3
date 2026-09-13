begin;

create or replace function public.get_founding_500_registry()
returns table (
  founding_member_number integer,
  status text,
  profile_id uuid,
  username text,
  display_name text,
  first_name text,
  last_name text,
  avatar_cloudinary_url text,
  profile_badge text,
  created_at timestamptz,
  assigned_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    fmn.number as founding_member_number,
    case
      when p.id is null then 'retired'
      else 'active'
    end as status,
    p.id as profile_id,
    p.username,
    p.display_name,
    case
      when case
        when lower(p.privacy_settings #>> '{profile_visibility,show_real_name}') in ('true', 'false')
          then (p.privacy_settings #>> '{profile_visibility,show_real_name}')::boolean
        else false
      end then p.first_name
      else null
    end as first_name,
    case
      when case
        when lower(p.privacy_settings #>> '{profile_visibility,show_real_name}') in ('true', 'false')
          then (p.privacy_settings #>> '{profile_visibility,show_real_name}')::boolean
        else false
      end then p.last_name
      else null
    end as last_name,
    p.avatar_cloudinary_url,
    p.profile_badge,
    p.created_at,
    fmn.assigned_at
  from public.founding_member_numbers fmn
  left join public.profiles p
    on p.id = fmn.profile_id
   and p.founding_member_number = fmn.number
   and p.account_type = 'user'
   and coalesce(p.is_deleted, false) = false
  order by fmn.number asc;
$$;

revoke all on function public.get_founding_500_registry() from public;
grant execute on function public.get_founding_500_registry() to anon, authenticated;

comment on function public.get_founding_500_registry() is
  'Public-safe Founding 500 registry. Active entries expose public profile-card fields; missing/deleted entries expose only retired status and number.';

commit;