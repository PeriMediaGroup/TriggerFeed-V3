-- Focused privacy/RLS audit smoke tests.
-- Run after local reset:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/privacy_rls_audit.sql

create extension if not exists pgcrypto;

do $$
declare
  hidden_id uuid := '20000000-0000-0000-0000-000000000001';
  public_id uuid := '20000000-0000-0000-0000-000000000002';
  other_id uuid := '20000000-0000-0000-0000-000000000003';
begin
  delete from auth.users
  where id in (hidden_id, public_id, other_id);

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
  values
    (
      hidden_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'privacy-hidden@example.com',
      crypt('testMe123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"username":"privacy_hidden","dob":"1980-01-01"}'::jsonb,
      now(),
      now()
    ),
    (
      public_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'privacy-public@example.com',
      crypt('testMe123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"username":"privacy_public","dob":"1981-01-01"}'::jsonb,
      now(),
      now()
    ),
    (
      other_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'privacy-other@example.com',
      crypt('testMe123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"username":"privacy_other","dob":"1982-01-01"}'::jsonb,
      now(),
      now()
    );

  update public.profiles
  set
    first_name = 'Hidden',
    last_name = 'User',
    city = 'Hidden City',
    state = 'HC',
    privacy_settings = jsonb_build_object(
      'profile_visibility',
      jsonb_build_object(
        'show_real_name', false,
        'show_age', false,
        'show_email', false,
        'show_city', false,
        'show_state', false
      )
    )
  where id = hidden_id;

  update public.profiles
  set
    first_name = 'Public',
    last_name = 'User',
    city = 'Public City',
    state = 'PC',
    privacy_settings = jsonb_build_object(
      'profile_visibility',
      jsonb_build_object(
        'show_real_name', true,
        'show_age', true,
        'show_email', true,
        'show_city', true,
        'show_state', true
      )
    )
  where id = public_id;
end $$;

set role anon;

do $$
declare
  hidden_profile record;
  public_profile record;
begin
  begin
    execute 'select email from public.profiles limit 1';
    raise exception 'anon direct profiles.email select should fail';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    execute 'select privacy_settings from public.profiles limit 1';
    raise exception 'anon direct profiles.privacy_settings select should fail';
  exception
    when insufficient_privilege then
      null;
  end;

  select *
  into hidden_profile
  from public.get_public_profile('20000000-0000-0000-0000-000000000001'::uuid);

  if hidden_profile.email is not null
    or hidden_profile.first_name is not null
    or hidden_profile.last_name is not null
    or hidden_profile.age is not null
    or hidden_profile.city is not null
    or hidden_profile.state is not null
    or hidden_profile.privacy_settings is not null then
    raise exception 'hidden public profile leaked private fields';
  end if;

  select *
  into public_profile
  from public.get_public_profile('20000000-0000-0000-0000-000000000002'::uuid);

  if public_profile.email <> 'privacy-public@example.com'
    or public_profile.first_name <> 'Public'
    or public_profile.last_name <> 'User'
    or public_profile.city <> 'Public City'
    or public_profile.state <> 'PC'
    or public_profile.age is null then
    raise exception 'public profile did not expose opted-in public fields';
  end if;

  if public_profile.privacy_settings is not null then
    raise exception 'get_public_profile should never expose raw privacy_settings';
  end if;
end $$;

reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', false);

select public.create_post_transactional(
  'Privacy vote boundary',
  'Body',
  'public',
  false,
  null,
  null
) as post_id
\gset

create temp table privacy_test_post_id (id uuid primary key);
insert into privacy_test_post_id (id)
values (:'post_id'::uuid);

select *
from public.toggle_post_vote(:'post_id'::uuid, 'upvote');

reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', false);

select *
from public.toggle_post_vote(:'post_id'::uuid, 'downvote');

do $$
declare
  raw_count integer;
  aggregate_count integer;
  own_vote_count integer;
begin
  begin
    select count(*) into raw_count from public.post_votes;
    raise exception 'authenticated direct post_votes select should fail';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    select count(*) into raw_count from public.post_vote_counts;
    raise exception 'authenticated direct post_vote_counts select should fail';
  exception
    when insufficient_privilege then
      null;
  end;

  select vote_count
  into aggregate_count
  from public.get_post_vote_counts(array[(select id from privacy_test_post_id)]);

  if aggregate_count <> 2 then
    raise exception 'get_post_vote_counts should expose aggregate count only, got %', aggregate_count;
  end if;

  select count(*)
  into own_vote_count
  from public.get_my_post_votes(array[(select id from privacy_test_post_id)]);

  if own_vote_count <> 1 then
    raise exception 'get_my_post_votes should expose the current user vote only';
  end if;
end $$;

reset role;

set role anon;

do $$
declare
  raw_count integer;
  aggregate_count integer;
begin
  begin
    select count(*) into raw_count from public.post_votes;
    raise exception 'anon direct post_votes select should fail';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    select count(*) into raw_count from public.post_vote_counts;
    raise exception 'anon direct post_vote_counts select should fail';
  exception
    when insufficient_privilege then
      null;
  end;

  select vote_count
  into aggregate_count
  from public.get_post_vote_counts(array[(select id from privacy_test_post_id)]);

  if aggregate_count <> 2 then
    raise exception 'anon get_post_vote_counts should expose aggregate count only, got %', aggregate_count;
  end if;
end $$;

reset role;

insert into public.friends (requester_id, addressee_id, status)
values (
  '20000000-0000-0000-0000-000000000001'::uuid,
  '20000000-0000-0000-0000-000000000002'::uuid,
  'accepted'
)
on conflict (requester_id, addressee_id) do update
set status = excluded.status;

insert into public.notifications (user_id, actor_id, type, title, body)
values
  (
    '20000000-0000-0000-0000-000000000001'::uuid,
    '20000000-0000-0000-0000-000000000002'::uuid,
    'friend_accepted',
    'A',
    'A'
  ),
  (
    '20000000-0000-0000-0000-000000000002'::uuid,
    '20000000-0000-0000-0000-000000000001'::uuid,
    'friend_accepted',
    'B',
    'B'
  );

set role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000003', false);

do $$
begin
  if public.are_users_accepted_friends(
    '20000000-0000-0000-0000-000000000001'::uuid,
    '20000000-0000-0000-0000-000000000002'::uuid
  ) then
    raise exception 'third-party user should not be able to confirm an accepted friendship';
  end if;
end $$;

reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', false);

do $$
declare
  visible_notifications integer;
begin
  if not public.are_users_accepted_friends(
    '20000000-0000-0000-0000-000000000001'::uuid,
    '20000000-0000-0000-0000-000000000002'::uuid
  ) then
    raise exception 'involved user should be able to confirm own accepted friendship';
  end if;

  select count(*)
  into visible_notifications
  from public.notifications;

  if visible_notifications <> 1 then
    raise exception 'authenticated user should read only own notifications, got %', visible_notifications;
  end if;
end $$;

reset role;

select 'privacy RLS audit smoke tests passed' as result;
