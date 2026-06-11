-- =========================================================
-- Local Dev Seed: Test Users
-- Creates 11 confirmed Supabase Auth users + matching profiles.
-- Password for all users: testMe123!
-- LOCAL ONLY. Do not run this on production unless chaos is your hobby.
--
-- Role setup:
-- test_0 = ceo
-- test_1 = admin
-- test_2 = moderator
-- test_3+ = user
--
-- Location setup:
-- test_0, test_1, test_2 = SC
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
  i integer;
  user_email text;
  user_name text;
  user_id uuid;
  user_dob date;
  birthday_date date;
  profile_role text;
  user_city text;
  user_state text;
begin
  for i in 0..10 loop
    user_email := 'test_' || i || '@example.com';
    user_name := 'test_' || i;

    -- Give each test user an upcoming birthday while keeping them adults.
    birthday_date := current_date + ((i % 21) + 1);

    user_dob := make_date(
      1980 + (i % 20),
      extract(month from birthday_date)::integer,
      extract(day from birthday_date)::integer
    );

    profile_role := case
      when i = 0 then 'ceo'
      when i = 1 then 'admin'
      when i = 2 then 'moderator'
      else 'user'
    end;

    user_city := case
      when i = 0 then 'Simpsonville'
      when i = 1 then 'Greenville'
      when i = 2 then 'Spartanburg'

      when i = 3 then 'Austin'
      when i = 4 then 'Dallas'

      when i = 5 then 'Boston'
      when i = 6 then 'Worcester'
      when i = 7 then 'Springfield'

      when i = 8 then 'Pittsburgh'
      when i = 9 then 'Philadelphia'

      else 'Charlotte'
    end;

    user_state := case
      when i in (0, 1, 2) then 'SC'
      when i in (3, 4) then 'TX'
      when i in (5, 6, 7) then 'MA'
      when i in (8, 9) then 'PA'
      else 'NC'
    end;

    -- Reuse existing user id if already created, otherwise make a new one.
    select id
    into user_id
    from auth.users
    where email = user_email
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
        user_email,
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
          'username', user_name,
          'display_name', 'Test User ' || i,
          'dob', user_dob,
          'city', user_city,
          'state', user_state
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
          'username', user_name,
          'display_name', 'Test User ' || i,
          'dob', user_dob,
          'city', user_city,
          'state', user_state
        ),
        updated_at = now()
      where id = user_id;
    end if;

    -- Email identity row. Needed so GoTrue treats this like a normal email user.
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
        'email', user_email,
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

    -- Profile row. Your auth trigger may create this too, but this guarantees it.
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
      user_email,
      user_name,
      lower(user_name),
      'Test User ' || i,
      'Test',
      'User ' || i,
      user_city,
      user_state,
      user_dob,
      now(),
      'v1',
      true,
      profile_role,
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

-- Verify
select
  u.email,
  p.username,
  p.username_lower,
  p.display_name,
  p.city,
  p.state,
  p.role,
  p.dob,
  to_char(p.dob, 'MM-DD') as birthday_month_day,
  p.age_verified_at is not null as age_verified,
  p.birthday_messages_enabled,
  u.email_confirmed_at is not null as confirmed
from auth.users u
left join public.profiles p
  on p.id = u.id
where u.email like 'test\_%@example.com'
order by u.email;