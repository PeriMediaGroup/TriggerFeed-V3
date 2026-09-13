-- Focused Founding 500 schema and assignment tests.
-- Run after migrations:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/founding_500.sql

begin;

create extension if not exists pgcrypto;

do $$
declare
  riot_id uuid := '25000000-0000-0000-0000-000000000001';
  keri_id uuid := '25000000-0000-0000-0000-000000000002';
  auto_one_id uuid := '25000000-0000-0000-0000-000000000003';
  auto_two_id uuid := '25000000-0000-0000-0000-000000000004';
  disabled_id uuid := '25000000-0000-0000-0000-000000000005';
  non_user_id uuid := '25000000-0000-0000-0000-000000000006';
  overflow_id uuid := '25000000-0000-0000-0000-000000000007';
  reuse_id uuid := '25000000-0000-0000-0000-000000000008';
  replacement_id uuid := '25000000-0000-0000-0000-000000000009';
begin
  update public.founding_500_settings
  set is_auto_assignment_enabled = false
  where singleton = true;

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
      disabled_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'founding-disabled@example.com',
      crypt('testMe123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"username":"founding_disabled","dob":"1980-01-01"}'::jsonb,
      now(),
      now()
    );

  if exists (
    select 1
    from public.profiles p
    where p.id = disabled_id
      and p.founding_member_number is not null
  ) then
    raise exception 'auto assignment should remain disabled before historical review';
  end if;

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
      riot_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'riot-founding@example.com',
      crypt('testMe123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"username":"founding_riot","dob":"1980-01-01"}'::jsonb,
      now() - interval '5 days',
      now() - interval '5 days'
    ),
    (
      keri_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'keri-founding@example.com',
      crypt('testMe123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"username":"founding_keri","dob":"1980-01-02"}'::jsonb,
      now() - interval '4 days',
      now() - interval '4 days'
    );

  update public.profiles
  set founding_member_number = 1
  where id = riot_id;

  update public.profiles
  set founding_member_number = 2
  where id = keri_id;

  if not exists (
    select 1
    from public.profiles p
    where p.id = riot_id
      and p.founding_member_number = 1
  ) then
    raise exception 'Founding Member #1 should be explicitly assignable';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = keri_id
      and p.founding_member_number = 2
  ) then
    raise exception 'Founding Member #2 should be explicitly assignable';
  end if;

  begin
    update public.profiles
    set founding_member_number = 3
    where id = riot_id;
    raise exception 'existing Founding Member number should be immutable';
  exception
    when raise_exception then
      if sqlerrm <> 'Founding Member numbers cannot be changed once assigned' then
        raise;
      end if;
  end;

  begin
    update public.profiles
    set founding_member_number = 2
    where id = disabled_id;
    raise exception 'duplicate Founding Member number should fail';
  exception
    when unique_violation then null;
  end;

  begin
    update public.profiles
    set founding_member_number = 501
    where id = disabled_id;
    raise exception 'out-of-range Founding Member number should fail';
  exception
    when raise_exception then
      if sqlerrm <> 'Founding Member number must be between 1 and 500' then
        raise;
      end if;
  end;

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
      non_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'founding-system@example.com',
      crypt('testMe123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"username":"founding_system","dob":"1980-01-01"}'::jsonb,
      now(),
      now()
    );

  update public.profiles
  set account_type = 'system'
  where id = non_user_id;

  begin
    update public.profiles
    set founding_member_number = 4
    where id = non_user_id;
    raise exception 'system account should not receive Founding Member number';
  exception
    when raise_exception then
      if sqlerrm <> 'Only user accounts can receive Founding Member numbers' then
        raise;
      end if;
  end;

  update public.founding_500_settings
  set is_auto_assignment_enabled = true
  where singleton = true;

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
      auto_one_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'founding-auto-one@example.com',
      crypt('testMe123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"username":"founding_auto_one","dob":"1980-01-03"}'::jsonb,
      now(),
      now()
    ),
    (
      auto_two_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'founding-auto-two@example.com',
      crypt('testMe123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"username":"founding_auto_two","dob":"1980-01-04"}'::jsonb,
      now(),
      now()
    );

  if not exists (
    select 1
    from public.profiles p
    where p.id = auto_one_id
      and p.founding_member_number = 3
  ) then
    raise exception 'first automatic Founding Member number should be #3';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = auto_two_id
      and p.founding_member_number = 4
  ) then
    raise exception 'second automatic Founding Member number should be #4';
  end if;

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
      reuse_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'founding-reuse-original@example.com',
      crypt('testMe123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"username":"founding_reuse_original","dob":"1980-01-05"}'::jsonb,
      now(),
      now()
    );

  if not exists (
    select 1
    from public.profiles p
    where p.id = reuse_id
      and p.founding_member_number = 5
  ) then
    raise exception 'reuse test setup should assign #5';
  end if;

  delete from auth.users
  where id = reuse_id;

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
  values (
    replacement_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'founding-reuse-replacement@example.com',
    crypt('testMe123!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"username":"founding_reuse_replacement","dob":"1980-01-06"}'::jsonb,
    now(),
    now()
  );

  if not exists (
    select 1
    from public.profiles p
    where p.id = replacement_id
      and p.founding_member_number = 6
  ) then
    raise exception 'deleted Founding Member numbers should not be reused';
  end if;

  insert into public.founding_member_numbers (number, profile_id)
  select n, '25000000-0000-0000-0000-00000000ffff'::uuid
  from generate_series(7, 500) as n;

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
      overflow_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'founding-overflow@example.com',
      crypt('testMe123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"username":"founding_overflow","dob":"1980-01-07"}'::jsonb,
      now(),
      now()
    );

  if exists (
    select 1
    from public.profiles p
    where p.id = overflow_id
      and p.founding_member_number is not null
  ) then
    raise exception 'profiles created after #500 should receive NULL';
  end if;
end $$;

rollback;
