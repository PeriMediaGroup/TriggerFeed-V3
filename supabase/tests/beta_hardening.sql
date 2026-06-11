-- Beta hardening smoke tests.
-- Run after local reset:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/beta_hardening.sql

create extension if not exists pgcrypto;

do $$
declare
  adult_id uuid := '10000000-0000-0000-0000-000000000001';
  underage_id uuid := '10000000-0000-0000-0000-000000000002';
  missing_dob_id uuid := '10000000-0000-0000-0000-000000000003';
  other_id uuid := '10000000-0000-0000-0000-000000000004';
begin
  delete from auth.users
  where id in (adult_id, underage_id, missing_dob_id, other_id);

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
      adult_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'beta-adult@example.com',
      crypt('testMe123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"username":"beta_adult","dob":"1980-01-01","age_gate_version":"v1","birthday_messages_enabled":true}'::jsonb,
      now(),
      now()
    ),
    (
      underage_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'beta-underage@example.com',
      crypt('testMe123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"username":"beta_underage","dob":"2015-01-01","age_gate_version":"v1","birthday_messages_enabled":true}'::jsonb,
      now(),
      now()
    ),
    (
      missing_dob_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'beta-missing-dob@example.com',
      crypt('testMe123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"username":"beta_missing"}'::jsonb,
      now(),
      now()
    ),
    (
      other_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'beta-other@example.com',
      crypt('testMe123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"username":"beta_other","dob":"1985-01-01"}'::jsonb,
      now(),
      now()
    );

  if not exists (
    select 1
    from public.profiles
    where id = adult_id
      and dob = date '1980-01-01'
      and age_verified_at is not null
  ) then
    raise exception 'adult DOB did not persist and verify';
  end if;

  if exists (
    select 1
    from public.profiles
    where id = underage_id
      and (dob is not null or age_verified_at is not null)
  ) then
    raise exception 'underage DOB should not be persisted or verified';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = missing_dob_id
      and username = 'beta_missing'
      and dob is null
      and age_verified_at is null
  ) then
    raise exception 'missing DOB profile should remain repairable';
  end if;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', false);

select *
from public.repair_my_age_gate('1988-02-03'::date, 'v1', true);

reset role;

do $$
declare
  missing_dob_id uuid := '10000000-0000-0000-0000-000000000003';
begin
  if not exists (
    select 1
    from public.profiles
    where id = missing_dob_id
      and dob = date '1988-02-03'
      and age_verified_at is not null
  ) then
    raise exception 'DOB repair did not verify missing DOB profile';
  end if;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);

select public.create_post_transactional(
  'Poll privacy test',
  'Body',
  'public',
  false,
  null,
  jsonb_build_object(
    'question', 'Pick one',
    'allows_multiple', false,
    'options', jsonb_build_array('A', 'B', 'C')
  )
) as post_id
\gset

insert into public.poll_responses (poll_id, option_id, user_id)
select poll.id, option.id, '10000000-0000-0000-0000-000000000001'::uuid
from public.polls poll
join public.poll_options option on option.poll_id = poll.id
where poll.post_id = :'post_id'::uuid
order by option.display_order
limit 1;

reset role;

insert into public.poll_responses (poll_id, option_id, user_id)
select poll.id, option.id, '10000000-0000-0000-0000-000000000004'::uuid
from public.polls poll
join public.poll_options option on option.poll_id = poll.id
where poll.post_id = :'post_id'::uuid
order by option.display_order desc
limit 1;

set role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);

do $$
declare
  raw_count integer;
  aggregate_total integer;
  own_count integer;
begin
  select count(*) into raw_count from public.poll_responses;

  if raw_count <> 1 then
    raise exception 'authenticated user should only read own poll response, got % rows', raw_count;
  end if;

  select count(*) into own_count
  from public.get_my_poll_responses(array[
    (
      select poll.id
      from public.polls poll
      join public.posts post on post.id = poll.post_id
      where post.title = 'Poll privacy test'
      limit 1
    )
  ]);

  if own_count <> 1 then
    raise exception 'get_my_poll_responses should return current user response';
  end if;

  select coalesce(sum(vote_count), 0) into aggregate_total
  from public.get_poll_results(array[
    (
      select poll.id
      from public.polls poll
      join public.posts post on post.id = poll.post_id
      where post.title = 'Poll privacy test'
      limit 1
    )
  ]);

  if aggregate_total <> 2 then
    raise exception 'aggregate poll results should include both votes, got %', aggregate_total;
  end if;
end $$;

reset role;
set role anon;

do $$
declare
  raw_count integer;
begin
  begin
    select count(*) into raw_count from public.poll_responses;
    raise exception 'anon should not be able to read raw poll responses';
  exception
    when insufficient_privilege then
      null;
  end;
end $$;

reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);

do $$
declare
  before_count integer;
  after_count integer;
begin
  select count(*) into before_count from public.posts where title = 'Rollback create';

  begin
    perform public.create_post_transactional(
      'Rollback create',
      'Body',
      'public',
      false,
      null,
      jsonb_build_object(
        'question', 'Broken',
        'allows_multiple', false,
        'options', jsonb_build_array(repeat('x', 121))
      )
    );
    raise exception 'create rollback test should have failed';
  exception
    when check_violation then
      null;
  end;

  select count(*) into after_count from public.posts where title = 'Rollback create';

  if after_count <> before_count then
    raise exception 'failed create transaction left a partial post';
  end if;
end $$;

select public.create_post_transactional(
  'Rollback edit original',
  'Body',
  'public',
  false,
  null,
  null
) as edit_post_id
\gset

do $$
begin
  begin
    perform public.update_post_transactional(
      (
        select id
        from public.posts
        where title = 'Rollback edit original'
        limit 1
      ),
      'Rollback edit changed',
      'Body',
      'public',
      false,
      null,
      false,
      jsonb_build_object(
        'question', 'Broken',
        'allows_multiple', false,
        'options', jsonb_build_array(repeat('x', 121))
      ),
      false
    );
    raise exception 'edit rollback test should have failed';
  exception
    when check_violation then
      null;
  end;

  if exists (
    select 1
    from public.posts
    where title = 'Rollback edit changed'
  ) then
    raise exception 'failed edit transaction left changed post title';
  end if;
end $$;

reset role;

update public.profiles
set is_muted = true
where id = '10000000-0000-0000-0000-000000000001'::uuid;

set role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);

do $$
begin
  begin
    perform public.update_post_transactional(
      (
        select id
        from public.posts
        where title = 'Rollback edit original'
        limit 1
      ),
      'Muted edit should fail',
      'Body',
      'public',
      false,
      null,
      false,
      null,
      false
    );
    raise exception 'muted user update should have failed';
  exception
    when others then
      if sqlerrm = 'muted user update should have failed' then
        raise;
      end if;
  end;
end $$;

reset role;

select 'beta hardening smoke tests passed' as result;
