-- =========================================================
-- Local Dev Seed: Test Users
-- Creates confirmed Supabase Auth users + matching profiles.
-- Password for all users: testMe123!
-- LOCAL ONLY. Do not run this on production unless chaos is your hobby.
--
-- Role setup:
-- TF-One = ceo
-- test_0 = admin
-- test_1 = admin
-- test_2 = moderator
-- test_3 through test_10 = user
--
-- Location setup:
-- TF-One, test_0, test_1, test_2 = SC
-- test_3, test_4 = TX
-- test_5, test_6, test_7 = MA
-- test_8, test_9 = PA
-- test_10 = NC control user
--
-- Birthdays:
-- All test users get birthdays within the next 21 days.
-- =========================================================

create extension if not exists pgcrypto;

do $$
declare
  seed_user record;
  user_id uuid;
  user_dob date;
  birthday_date date;
begin
  for seed_user in
    select *
    from (
      values
        ('tf-one@example.com', 'TF-One', 'TF One', 'TriggerFeed', 'One', 'ceo', 'Greenville', 'SC', 0),
        ('test_0@example.com', 'test_0', 'Test User 0', 'Test', 'User 0', 'admin', 'Simpsonville', 'SC', 1),
        ('test_1@example.com', 'test_1', 'Test User 1', 'Test', 'User 1', 'admin', 'Greenville', 'SC', 2),
        ('test_2@example.com', 'test_2', 'Test User 2', 'Test', 'User 2', 'moderator', 'Spartanburg', 'SC', 3),
        ('test_3@example.com', 'test_3', 'Test User 3', 'Test', 'User 3', 'user', 'Austin', 'TX', 4),
        ('test_4@example.com', 'test_4', 'Test User 4', 'Test', 'User 4', 'user', 'Dallas', 'TX', 5),
        ('test_5@example.com', 'test_5', 'Test User 5', 'Test', 'User 5', 'user', 'Boston', 'MA', 6),
        ('test_6@example.com', 'test_6', 'Test User 6', 'Test', 'User 6', 'user', 'Worcester', 'MA', 7),
        ('test_7@example.com', 'test_7', 'Test User 7', 'Test', 'User 7', 'user', 'Springfield', 'MA', 8),
        ('test_8@example.com', 'test_8', 'Test User 8', 'Test', 'User 8', 'user', 'Pittsburgh', 'PA', 9),
        ('test_9@example.com', 'test_9', 'Test User 9', 'Test', 'User 9', 'user', 'Philadelphia', 'PA', 10),
        ('test_10@example.com', 'test_10', 'Test User 10', 'Test', 'User 10', 'user', 'Charlotte', 'NC', 11)
    ) as seed_data(
      email,
      username,
      display_name,
      first_name,
      last_name,
      role,
      city,
      state,
      offset_days
    )
  loop
    birthday_date := current_date + ((seed_user.offset_days % 21) + 1);

    user_dob := make_date(
      1980 + (seed_user.offset_days % 20),
      extract(month from birthday_date)::integer,
      extract(day from birthday_date)::integer
    );

    select id
    into user_id
    from auth.users
    where email = seed_user.email
    limit 1;

    if user_id is null then
      user_id := gen_random_uuid();

      insert into auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        invited_at,
        confirmation_token,
        confirmation_sent_at,
        recovery_token,
        recovery_sent_at,
        email_change_token_new,
        email_change,
        email_change_sent_at,
        last_sign_in_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        created_at,
        updated_at,
        phone,
        phone_confirmed_at,
        phone_change,
        phone_change_token,
        phone_change_sent_at,
        email_change_token_current,
        email_change_confirm_status,
        banned_until,
        reauthentication_token,
        reauthentication_sent_at,
        is_sso_user,
        deleted_at,
        is_anonymous
      )
      values (
        user_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        seed_user.email,
        crypt('testMe123!', gen_salt('bf')),
        now(),
        null,
        '',
        null,
        '',
        null,
        '',
        '',
        null,
        null,
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object(
          'username', seed_user.username,
          'display_name', seed_user.display_name,
          'dob', user_dob,
          'city', seed_user.city,
          'state', seed_user.state
        ),
        false,
        now(),
        now(),
        null,
        null,
        '',
        '',
        null,
        '',
        0,
        null,
        '',
        null,
        false,
        null,
        false
      );
    else
      update auth.users
      set
        encrypted_password = crypt('testMe123!', gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
        raw_user_meta_data = jsonb_build_object(
          'username', seed_user.username,
          'display_name', seed_user.display_name,
          'dob', user_dob,
          'city', seed_user.city,
          'state', seed_user.state
        ),
        updated_at = now()
      where id = user_id;
    end if;

    insert into auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    )
    values (
      gen_random_uuid(),
      user_id,
      user_id::text,
      jsonb_build_object(
        'sub', user_id::text,
        'email', seed_user.email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      null,
      now(),
      now()
    )
    on conflict (provider, provider_id) do update
    set
      identity_data = excluded.identity_data,
      updated_at = now();

    insert into public.profiles (
      id,
      email,
      username,
      username_lower,
      display_name,
      first_name,
      last_name,
      city,
      state,
      dob,
      age_verified_at,
      age_gate_version,
      birthday_messages_enabled,
      role,
      is_banned,
      is_muted,
      is_deleted,
      privacy_settings,
      created_at,
      updated_at
    )
    values (
      user_id,
      seed_user.email,
      seed_user.username,
      lower(seed_user.username),
      seed_user.display_name,
      seed_user.first_name,
      seed_user.last_name,
      seed_user.city,
      seed_user.state,
      user_dob,
      now(),
      'v1',
      true,
      seed_user.role,
      false,
      false,
      false,
      jsonb_build_object(
        'profile_visibility',
        jsonb_build_object(
          'show_city', false,
          'show_state', false,
          'show_email', false,
          'show_real_name', false,
          'show_age', false
        )
      ),
      now(),
      now()
    )
    on conflict (id) do update
    set
      email = excluded.email,
      username = excluded.username,
      username_lower = excluded.username_lower,
      display_name = excluded.display_name,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      city = excluded.city,
      state = excluded.state,
      dob = excluded.dob,
      age_verified_at = excluded.age_verified_at,
      age_gate_version = excluded.age_gate_version,
      birthday_messages_enabled = excluded.birthday_messages_enabled,
      role = excluded.role,
      is_banned = false,
      is_muted = false,
      is_deleted = false,
      privacy_settings = excluded.privacy_settings,
      updated_at = now();
  end loop;
end $$;

select username, email, role
from public.profiles
order by
  case
    when username = 'TF-One' then 0
    when username like 'test_%' then 1
    else 2
  end,
  username;
