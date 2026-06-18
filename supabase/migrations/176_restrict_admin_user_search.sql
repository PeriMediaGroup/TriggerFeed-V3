-- =========================================================
-- 176: Restrict Admin User Search To Admin/CEO
-- =========================================================

begin;

create or replace function public.search_admin_users(
  p_query text default '',
  p_limit int default 50
)
returns table (
  id uuid,
  username text,
  display_name text,
  email text,
  avatar_cloudinary_url text,
  role text,
  is_muted boolean,
  is_banned boolean,
  is_deleted boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_query text := lower(nullif(trim(coalesce(p_query, '')), ''));
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_can_view_email boolean := public.is_admin_or_above();
begin
  if not v_can_view_email then
    raise exception 'Admin permission required';
  end if;

  return query
  select
    p.id,
    p.username,
    p.display_name,
    case when v_can_view_email then p.email else null end as email,
    p.avatar_cloudinary_url,
    p.role,
    coalesce(p.is_muted, false) as is_muted,
    coalesce(p.is_banned, false) as is_banned,
    coalesce(p.is_deleted, false) as is_deleted,
    p.created_at
  from public.profiles p
  where
    v_query is null
    or lower(coalesce(p.username, '')) like '%' || v_query || '%'
    or lower(coalesce(p.display_name, '')) like '%' || v_query || '%'
    or lower(coalesce(p.role, '')) = v_query
    or (
      v_query in ('muted', 'mute')
      and coalesce(p.is_muted, false) = true
    )
    or (
      v_query in ('banned', 'ban')
      and coalesce(p.is_banned, false) = true
    )
    or (
      v_query in ('deleted', 'removed')
      and coalesce(p.is_deleted, false) = true
    )
    or (
      v_query in ('active', 'enabled')
      and coalesce(p.is_muted, false) = false
      and coalesce(p.is_banned, false) = false
      and coalesce(p.is_deleted, false) = false
    )
    or (
      v_can_view_email
      and lower(coalesce(p.email, '')) like '%' || v_query || '%'
    )
  order by p.created_at desc
  limit v_limit;
end;
$$;

revoke all on function public.search_admin_users(text, int) from public;
grant execute on function public.search_admin_users(text, int) to authenticated;

commit;
