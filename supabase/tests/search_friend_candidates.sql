-- Focused friend-candidate search and privacy tests.
-- Run after local reset:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/search_friend_candidates.sql

begin;
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
    'founding_member_number',
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

-- New permission and public-profile compatibility checks use the same fixtures.
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$
declare
  statement text;
  denied boolean;
  card record;
begin
  foreach statement in array array[
    'select * from public.search_friend_candidates(''alice'',25)',
    'select * from public.get_friend_suggestions(20)',
    'select public.are_users_accepted_friends(''21000000-0000-0000-0000-000000000001'',''21000000-0000-0000-0000-000000000004'')',
    'select requester_id,addressee_id,status from public.friends',
    'select email,privacy_settings from public.profiles'
  ] loop
    denied := false;
    begin
      execute statement;
    exception when insufficient_privilege then denied := true;
    end;
    if not denied then raise exception 'Anonymous private discovery access allowed: %', statement; end if;
  end loop;

  select * into card from public.get_public_profile_cards(array['21000000-0000-0000-0000-000000000004'::uuid]);
  if card.id is null or card.first_name is not null or card.last_name is not null
    or card.city is not null or card.state is not null then
    raise exception 'Public card unavailable or private fields exposed';
  end if;
  if exists(select 1 from public.get_public_profile_cards(array['21000000-0000-0000-0000-000000000005'::uuid])) then
    raise exception 'Deleted profile card exposed';
  end if;
  if not exists(select 1 from public.get_public_profile('21000000-0000-0000-0000-000000000004')) then
    raise exception 'Public profile access was broken';
  end if;
  perform * from public.get_public_profile_badges(array['21000000-0000-0000-0000-000000000004'::uuid]);
  -- Some local databases predate this optional public metadata RPC.
  if to_regprocedure('public.get_public_profile_metadata(uuid[])') is not null then
    perform * from public.get_public_profile_metadata(array['21000000-0000-0000-0000-000000000004'::uuid]);
  else
    raise notice 'SKIPPED public metadata compatibility: RPC absent from this database';
  end if;
  if not public.is_profile_visible('21000000-0000-0000-0000-000000000004') then
    raise exception 'Public visibility helper was broken';
  end if;
  if public.get_profile_friend_count('21000000-0000-0000-0000-000000000004') < 1 then
    raise exception 'Public aggregate friend count was broken';
  end if;
end $$;
reset role;

-- Make the otherwise unrelated candidate eligible for a deterministic suggestion.
update public.profiles set state = 'CC' where id = '21000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', '21000000-0000-0000-0000-000000000001', true);
do $$
begin
  if not exists(select 1 from public.get_friend_suggestions(p_limit => 20) where id = '21000000-0000-0000-0000-000000000003') then
    raise exception 'Authenticated suggestions stopped working';
  end if;
  if exists(select 1 from public.get_friend_suggestions(20) where id in (
    '21000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000002',
    '21000000-0000-0000-0000-000000000004','21000000-0000-0000-0000-000000000005','21000000-0000-0000-0000-000000000006')) then
    raise exception 'Suggestion eligibility or existing relationship filtering changed';
  end if;
  perform * from public.search_friend_candidates(p_query => '@alice', p_limit => 50);
  if not public.are_users_accepted_friends('21000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000004') then
    raise exception 'Own accepted relationship check failed';
  end if;
  if public.are_users_accepted_friends('21000000-0000-0000-0000-000000000002','21000000-0000-0000-0000-000000000004') then
    raise exception 'Unrelated relationship check leaked';
  end if;
end $$;
reset role;

update public.profiles set is_muted = true where id = '21000000-0000-0000-0000-000000000003';
set local role authenticated;
do $$ begin
  if exists(select 1 from public.get_friend_suggestions(20) where id = '21000000-0000-0000-0000-000000000003') then
    raise exception 'Muted candidate suggested';
  end if;
end $$;
reset role;
update public.profiles set is_muted = false where id = '21000000-0000-0000-0000-000000000003';

update public.profiles set is_banned = true where id = '21000000-0000-0000-0000-000000000001';
set local role authenticated;
do $$ begin
  if exists(select 1 from public.get_friend_suggestions(20)) then
    raise exception 'Banned viewer received suggestions';
  end if;
end $$;
reset role;
update public.profiles set is_banned = false, is_deleted = true where id = '21000000-0000-0000-0000-000000000001';
set local role authenticated;
do $$ begin
  if exists(select 1 from public.get_friend_suggestions(20)) then
    raise exception 'Deleted viewer received suggestions';
  end if;
end $$;
reset role;
update public.profiles set is_deleted = false where id = '21000000-0000-0000-0000-000000000001';

insert into public.friends(requester_id,addressee_id,status)
values('21000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000003','blocked');
set local role authenticated;
do $$ begin
  if exists(select 1 from public.get_friend_suggestions(20) where id = '21000000-0000-0000-0000-000000000003') then
    raise exception 'Blocked relationship suggested';
  end if;
  if not exists(select 1 from public.search_friend_candidates('user_alice',25) where friendship_status = 'blocked') then
    raise exception 'Existing blocked search state changed';
  end if;
end $$;
reset role;

do $$
declare signature text;
begin
  foreach signature in array array['public.search_friend_candidates(text,integer)',
    'public.get_friend_suggestions(integer)','public.are_users_accepted_friends(uuid,uuid)'] loop
    if has_function_privilege('anon',signature,'EXECUTE')
      or not has_function_privilege('authenticated',signature,'EXECUTE')
      or not has_function_privilege('service_role',signature,'EXECUTE') then
      raise exception 'Incorrect grants for %', signature;
    end if;
    if exists(select 1 from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
      where p.oid=signature::regprocedure and acl.grantee=0 and acl.privilege_type='EXECUTE') then
      raise exception 'PUBLIC can execute %', signature;
    end if;
    if not exists(select 1 from pg_proc where oid=signature::regprocedure and prosecdef and 'search_path=""'=any(proconfig)) then
      raise exception 'Unexpected security configuration for %', signature;
    end if;
  end loop;
end $$;
select 'friend discovery permissions and public profile compatibility passed' as result;
rollback;
