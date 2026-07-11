-- Focused user activity and admin overview RPC tests.
-- Run after local reset:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/user_activity_overview.sql

create extension if not exists pgcrypto;

do $$
declare
  admin_id uuid := '24000000-0000-0000-0000-000000000001';
  ceo_id uuid := '24000000-0000-0000-0000-000000000002';
  user_id uuid := '24000000-0000-0000-0000-000000000003';
  moderator_id uuid := '24000000-0000-0000-0000-000000000004';
  old_user_id uuid := '24000000-0000-0000-0000-000000000005';
  deleted_user_id uuid := '24000000-0000-0000-0000-000000000006';
begin
  delete from auth.users
  where id in (
    admin_id,
    ceo_id,
    user_id,
    moderator_id,
    old_user_id,
    deleted_user_id
  );

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
      admin_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'activity-admin@example.com',
      crypt('testMe123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"username":"activity_admin"}'::jsonb,
      now(),
      now()
    ),
    (
      ceo_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'activity-ceo@example.com',
      crypt('testMe123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"username":"activity_ceo"}'::jsonb,
      now(),
      now()
    ),
    (
      user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'activity-user@example.com',
      crypt('testMe123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"username":"activity_user"}'::jsonb,
      now(),
      now()
    ),
    (
      moderator_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'activity-moderator@example.com',
      crypt('testMe123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"username":"activity_moderator"}'::jsonb,
      now(),
      now()
    ),
    (
      old_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'activity-old@example.com',
      crypt('testMe123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"username":"activity_old"}'::jsonb,
      now() - interval '30 days',
      now()
    ),
    (
      deleted_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'activity-deleted@example.com',
      crypt('testMe123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"username":"activity_deleted"}'::jsonb,
      now(),
      now()
    );

  update public.profiles
  set role = 'admin',
      display_name = 'Activity Admin'
  where id = admin_id;

  update public.profiles
  set role = 'ceo',
      display_name = 'Activity CEO'
  where id = ceo_id;

  update public.profiles
  set role = 'moderator',
      display_name = 'Activity Moderator'
  where id = moderator_id;

  update public.profiles
  set display_name = 'Activity User'
  where id = user_id;

  update public.profiles
  set display_name = 'Old Activity User',
      created_at = now() - interval '30 days'
  where id = old_user_id;

  update public.profiles
  set display_name = 'Deleted Activity User',
      is_deleted = true
  where id = deleted_user_id;
end $$;

set role anon;

do $$
begin
  if has_function_privilege('anon', 'public.touch_user_activity()', 'execute') then
    raise exception 'anonymous role should not execute touch_user_activity';
  end if;

  if has_function_privilege(
    'anon',
    'public.get_admin_activity_overview(integer)',
    'execute'
  ) then
    raise exception 'anonymous role should not execute get_admin_activity_overview';
  end if;
end $$;

reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '', false);

do $$
begin
  begin
    perform public.touch_user_activity();
  exception
    when raise_exception then
      if sqlerrm <> 'Authentication required' then
        raise;
      end if;
      return;
  end;

  raise exception 'authenticated role without auth.uid() should not touch activity';
end $$;

select set_config('request.jwt.claim.sub', '24000000-0000-0000-0000-000000000003', false);

do $$
begin
  begin
    insert into public.user_activity (user_id)
    values ('24000000-0000-0000-0000-000000000004');
  exception
    when insufficient_privilege then
      return;
  end;

  raise exception 'users should not directly touch another activity row';
end $$;

do $$
begin
  perform public.touch_user_activity();

  if not exists (
    select 1
    from public.user_activity
    where user_id = '24000000-0000-0000-0000-000000000003'
  ) then
    raise exception 'authenticated user activity row was not created';
  end if;
end $$;

do $$
begin
  begin
    perform public.get_admin_activity_overview(10);
  exception
    when raise_exception then
      if sqlerrm <> 'Admin permission required' then
        raise;
      end if;
      return;
  end;

  raise exception 'normal users should not call admin activity overview';
end $$;

select set_config('request.jwt.claim.sub', '24000000-0000-0000-0000-000000000004', false);

do $$
begin
  begin
    perform public.get_admin_activity_overview(10);
  exception
    when raise_exception then
      if sqlerrm <> 'Admin permission required' then
        raise;
      end if;
      return;
  end;

  raise exception 'moderators should not call admin activity overview';
end $$;

reset role;

delete from public.user_activity;

set role authenticated;
select set_config('request.jwt.claim.sub', '24000000-0000-0000-0000-000000000001', false);

do $$
declare
  overview jsonb;
begin
  overview := public.get_admin_activity_overview(10);

  if (overview->>'online_now')::integer <> 0
    or (overview->>'active_7_days')::integer <> 0
    or jsonb_array_length(overview->'recent_users') <> 0 then
    raise exception 'no activity rows should produce zero activity counts: %', overview;
  end if;
end $$;

reset role;

insert into public.user_activity (user_id, last_seen_at, last_login_at)
values
  ('24000000-0000-0000-0000-000000000003', now() - interval '4 minutes', now() - interval '1 day'),
  ('24000000-0000-0000-0000-000000000005', now() - interval '8 days', null),
  ('24000000-0000-0000-0000-000000000006', now() - interval '3 minutes', null);

set role authenticated;
select set_config('request.jwt.claim.sub', '24000000-0000-0000-0000-000000000001', false);

do $$
declare
  overview jsonb;
begin
  overview := public.get_admin_activity_overview(10);

  if (overview->>'online_now')::integer <> 1
    or (overview->>'active_7_days')::integer <> 1
    or (overview->>'new_7_days')::integer < 3
    or (overview->>'total_users')::integer < 5
    or jsonb_array_length(overview->'recent_users') < 2 then
    raise exception 'admin overview counts are incorrect: %', overview;
  end if;
end $$;

select set_config('request.jwt.claim.sub', '24000000-0000-0000-0000-000000000002', false);

do $$
declare
  overview jsonb;
begin
  overview := public.get_admin_activity_overview(2);

  if jsonb_array_length(overview->'recent_users') <> 2 then
    raise exception 'recent user limit was not respected: %', overview;
  end if;
end $$;

reset role;

select 'user activity overview tests passed' as result;
