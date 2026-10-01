-- Member-only discovery and relationship checks. Supabase default privileges can
-- grant anon explicitly, so revoking PUBLIC alone is insufficient.
-- Preserve function bodies, signatures, owners, authenticated and system access.
revoke execute on function public.search_friend_candidates(text, integer) from public, anon;
revoke execute on function public.get_friend_suggestions(integer) from public, anon;
revoke execute on function public.are_users_accepted_friends(uuid, uuid) from public, anon;

grant execute on function public.search_friend_candidates(text, integer) to authenticated;
grant execute on function public.get_friend_suggestions(integer) to authenticated;
grant execute on function public.are_users_accepted_friends(uuid, uuid) to authenticated;

-- All relation/helper references in these SECURITY DEFINER bodies are already
-- schema-qualified. Resolve built-ins via pg_catalog, with no writable schema.
alter function public.search_friend_candidates(text, integer) set search_path = '';
alter function public.get_friend_suggestions(integer) set search_path = '';
alter function public.are_users_accepted_friends(uuid, uuid) set search_path = '';

-- Intentional anonymous public profile/card/badge/metadata reads and aggregate
-- profile friend counts remain unchanged. Do not alter global default privileges.
