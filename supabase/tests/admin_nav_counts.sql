-- Focused admin navigation count RPC tests.
-- Run after local reset:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/admin_nav_counts.sql

create extension if not exists pgcrypto;

do $$
declare
  moderator_id uuid := '22000000-0000-0000-0000-000000000001';
  admin_id uuid := '22000000-0000-0000-0000-000000000002';
  user_id uuid := '22000000-0000-0000-0000-000000000003';
  post_id uuid := '22000000-0000-0000-0000-000000000004';
begin
  delete from auth.users
  where id in (moderator_id, admin_id, user_id);

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
      moderator_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'admin-counts-moderator@example.com',
      crypt('testMe123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"username":"admin_counts_moderator"}'::jsonb,
      now(),
      now()
    ),
    (
      admin_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'admin-counts-admin@example.com',
      crypt('testMe123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"username":"admin_counts_admin"}'::jsonb,
      now(),
      now()
    ),
    (
      user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'admin-counts-user@example.com',
      crypt('testMe123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"username":"admin_counts_user"}'::jsonb,
      now(),
      now()
    );

  update public.profiles set role = 'moderator' where id = moderator_id;
  update public.profiles set role = 'admin' where id = admin_id;

  insert into public.posts (id, user_id, title, body)
  values (post_id, user_id, 'Reported post', 'Body for admin nav counts test')
  on conflict (id) do nothing;

  insert into public.post_reports (post_id, reporter_id, reason, status)
  values
    (post_id, moderator_id, 'spam', 'open')
  on conflict (post_id, reporter_id) do update
  set status = excluded.status;

  insert into public.abuse_reports (email, link, details, source, status)
  values
    (
      'admin-counts-reporter@example.com',
      'https://triggerfeed.test/reported',
      'This is a focused abuse report count test.',
      'admin-nav-counts-test',
      'new'
    );
end $$;

set role anon;

do $$
begin
  if has_function_privilege(
    'anon',
    'public.get_admin_nav_counts()',
    'execute'
  ) then
    raise exception 'anonymous role should not be able to execute admin nav counts';
  end if;
end $$;

reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '', false);

do $$
begin
  begin
    perform public.get_admin_nav_counts();
  exception
    when raise_exception then
      if sqlerrm <> 'Authentication required' then
        raise;
      end if;
      return;
  end;

  raise exception 'authenticated role without auth.uid() should be rejected';
end $$;

select set_config('request.jwt.claim.sub', '22000000-0000-0000-0000-000000000003', false);

do $$
begin
  begin
    perform public.get_admin_nav_counts();
  exception
    when raise_exception then
      if sqlerrm <> 'Moderator permission required' then
        raise;
      end if;
      return;
  end;

  raise exception 'normal users should not be able to execute admin nav counts';
end $$;

select set_config('request.jwt.claim.sub', '22000000-0000-0000-0000-000000000001', false);

do $$
declare
  counts jsonb;
begin
  counts := public.get_admin_nav_counts();

  if (counts->>'reports')::integer < 1 then
    raise exception 'moderator should see pending post report counts: %', counts;
  end if;

  if (counts->>'abuseReports')::integer <> 0 then
    raise exception 'moderator should not receive abuse report counts: %', counts;
  end if;
end $$;

select set_config('request.jwt.claim.sub', '22000000-0000-0000-0000-000000000002', false);

do $$
declare
  counts jsonb;
begin
  counts := public.get_admin_nav_counts();

  if (counts->>'reports')::integer < 1
    or (counts->>'abuseReports')::integer < 1
    or (counts->>'reviews')::integer <> 0
    or (counts->>'roleReviews')::integer <> 0
    or (counts->>'total')::integer <> (
      (counts->>'reports')::integer
      + (counts->>'abuseReports')::integer
      + (counts->>'reviews')::integer
      + (counts->>'roleReviews')::integer
    ) then
    raise exception 'admin counts are incorrect: %', counts;
  end if;
end $$;

reset role;

select 'admin nav counts tests passed' as result;
