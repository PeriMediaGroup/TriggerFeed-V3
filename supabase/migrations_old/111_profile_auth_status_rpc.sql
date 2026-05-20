begin;

create or replace function public.get_my_profile_auth_status()
returns table (
  id uuid,
  username text,
  is_banned boolean,
  is_deleted boolean
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    p.username,
    coalesce(p.is_banned, false) as is_banned,
    coalesce(p.is_deleted, false) as is_deleted
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

revoke all on function public.get_my_profile_auth_status() from public;
grant execute on function public.get_my_profile_auth_status() to authenticated;

commit;