-- Focused friend-candidate search and privacy tests.
-- Run after local reset:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/search_friend_candidates.sql

create extension if not exists pgcrypto;

do $$
declare
  viewer_id uuid := '21000000-0000-0000-0000-000000000001';
  prefix_id uuid := '21000000-0000-0000-0000-000000000002';
  contains_id uuid := '21000000-0000-0000-0000-000000000003';
  hidden_id uuid := '21000000-0000-0000-0000-000000000004';
  deleted_id uuid := '21000000-0000-0000-0000-000000000005';
  banned_id uuid := '21000000-0000-0000-0000-000000000006';
begin
  delete from auth.users
  where id in (viewer_id, prefix_id, contains_id, hidden_id, deleted_id, banned_id);

  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  select
    seed.id,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    seed.email,
    crypt('testMe123!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('username', seed.username),
    now(),
    now()
  from (
    values
      (viewer_id, 'friend-search-viewer@example.com', 'friend_search_viewer'),
      (prefix_id, 'friend-search-prefix@example.com', 'alice_prefix'),
      (contains_id, 'friend-search-contains@example.com', 'user_alice'),
      (hidden_id, 'friend-search-hidden@example.com', 'hidden_person'),
      (deleted_id, 'friend-search-deleted@example.com', 'deleted_alice'),
      (banned_id, 'friend-search-banned@example.com', 'banned_alice')
  ) as seed(id, email, username);

  update public.profiles
  set
    display_name = 'Alice Prefix',
    first_name = 'Alice',
    last_name = 'Anderson',
    city = 'Visible City',
    state = 'VC',
    avatar_cloudinary_url = 'https://example.com/alice.jpg',
    privacy_settings = jsonb_build_object(
      'profile_visibility',
      jsonb_build_object('show_city', true, 'show_state', true)
    )
  where id = prefix_id;

  update public.profiles
  set
    display_name = 'Contains Match',
    first_name = 'Malice',
    last_name = 'Example',
    city = 'Contains City',
    state = 'CC',
    privacy_settings = jsonb_build_object(
      'profile_visibility',
      jsonb_build_object('show_city', false, 'show_state', false)
    )
  where id = contains_id;

  update public.profiles
  set
    display_name = 'Private Public Card',
    first_name = 'Full',
    last_name = 'NameTarget',
    city = 'Hidden City',
    state = 'HC',
    privacy_settings = jsonb_build_object(
      'profile_visibility',
      jsonb_build_object('show_city', false, 'show_state', false)
    )
  where id = hidden_id;

  update public.profiles set is_deleted = true where id = deleted_id;
  update public.profiles set is_banned = true where id = banned_id;

  insert into public.friends (requester_id, addressee_id, status)
  values
    (viewer_id, prefix_id, 'pending'),
    (hidden_id, viewer_id, 'accepted');
end $$;

set role anon;

do $$
begin
  if has_function_privilege(
    'anon',
    'public.search_friend_candidates(text, integer)',
    'execute'
  ) then
    raise exception 'anonymous role should not be able to execute friend search';
  end if;
end $$;

reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '', false);

do $$
begin
  begin
    perform public.search_friend_candidates('alice', 25);
  exception
    when raise_exception then
      if sqlerrm <> 'Authentication required' then
        raise;
      end if;
      return;
  end;

  raise exception 'authenticated role without auth.uid() should be rejected';
end $$;

select set_config('request.jwt.claim.sub', '21000000-0000-0000-0000-000000000001', false);

do $$
declare
  first_result record;
  prefix_result record;
  hidden_result record;
  result_count integer;
  result_keys text[];
begin
  select *
  into first_result
  from public.search_friend_candidates('alice', 25)
  limit 1;

  if first_result.id <> '21000000-0000-0000-0000-000000000002'::uuid then
    raise exception 'prefix match should rank before contains match';
  end if;

  select *
  into prefix_result
  from public.search_friend_candidates('@alice', 25)
  where id = '21000000-0000-0000-0000-000000000002'::uuid;

  if prefix_result.friendship_status <> 'pending'
    or prefix_result.city <> 'Visible City'
    or prefix_result.state <> 'VC' then
    raise exception 'pending status or opted-in location was not returned correctly';
  end if;

  select *
  into hidden_result
  from public.search_friend_candidates('Full NameTarget', 25)
  where id = '21000000-0000-0000-0000-000000000004'::uuid;

  if hidden_result.id is null
    or hidden_result.friendship_status <> 'accepted'
    or hidden_result.city is not null
    or hidden_result.state is not null then
    raise exception 'full-name search, accepted status, or hidden location failed';
  end if;

  select count(*)
  into result_count
  from public.search_friend_candidates('alice', 50)
  where id in (
    '21000000-0000-0000-0000-000000000001'::uuid,
    '21000000-0000-0000-0000-000000000005'::uuid,
    '21000000-0000-0000-0000-000000000006'::uuid
  );

  if result_count <> 0 then
    raise exception 'viewer, deleted, or banned profiles leaked into results';
  end if;

  select count(*)
  into result_count
  from public.search_friend_candidates('a', 0);

  if result_count > 1 then
    raise exception 'p_limit should be clamped to at least one';
  end if;

  select array_agg(key order by key)
  into result_keys
  from jsonb_object_keys(to_jsonb(prefix_result)) as key;

  if result_keys <> array[
    'avatar_cloudinary_url',
    'city',
    'display_name',
    'friendship_status',
    'id',
    'state',
    'username'
  ]::text[] then
    raise exception 'friend search returned unsafe or unexpected fields: %', result_keys;
  end if;
end $$;

reset role;

select 'friend candidate search tests passed' as result;
