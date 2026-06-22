-- Focused Top Guns image metadata and ownership tests.
-- Run after local reset:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/top_gun_images.sql

create extension if not exists pgcrypto;

do $$
declare
  owner_id uuid := '22000000-0000-0000-0000-000000000001';
  other_id uuid := '22000000-0000-0000-0000-000000000002';
begin
  delete from auth.users where id in (owner_id, other_id);

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
      owner_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'top-gun-owner@example.com',
      crypt('testMe123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"username":"top_gun_owner"}'::jsonb,
      now(),
      now()
    ),
    (
      other_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'top-gun-other@example.com',
      crypt('testMe123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"username":"top_gun_other"}'::jsonb,
      now(),
      now()
    );
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '22000000-0000-0000-0000-000000000001', false);

insert into public.profile_top_guns (
  user_id,
  name,
  display_order,
  image_cloudinary_url,
  image_cloudinary_secure_url,
  image_cloudinary_public_id,
  image_width,
  image_height
)
values
  (
    '22000000-0000-0000-0000-000000000001',
    'Test Gun One',
    0,
    'https://res.cloudinary.com/triggerfeed/image/upload/test-gun-one.jpg',
    'https://res.cloudinary.com/triggerfeed/image/upload/test-gun-one.jpg',
    'triggerfeed/guns/22000000-0000-0000-0000-000000000001/test-gun-one',
    640,
    480
  ),
  (
    '22000000-0000-0000-0000-000000000001',
    'Test Gun Two',
    1,
    null,
    null,
    null,
    null,
    null
  ),
  (
    '22000000-0000-0000-0000-000000000001',
    'Test Gun Three',
    2,
    'https://res.cloudinary.com/triggerfeed/image/upload/test-gun-three.jpg',
    'https://res.cloudinary.com/triggerfeed/image/upload/test-gun-three.jpg',
    'triggerfeed/guns/22000000-0000-0000-0000-000000000001/test-gun-three',
    800,
    600
  ),
  (
    '22000000-0000-0000-0000-000000000001',
    'Test Gun Four',
    3,
    'https://res.cloudinary.com/triggerfeed/image/upload/test-gun-four.jpg',
    'https://res.cloudinary.com/triggerfeed/image/upload/test-gun-four.jpg',
    'triggerfeed/guns/22000000-0000-0000-0000-000000000001/test-gun-four',
    1024,
    768
  );

update public.profile_top_guns
set
  image_cloudinary_url =
    'https://res.cloudinary.com/triggerfeed/image/upload/test-gun-one-replaced.jpg',
  image_cloudinary_secure_url =
    'https://res.cloudinary.com/triggerfeed/image/upload/test-gun-one-replaced.jpg',
  image_width = 1200,
  image_height = 900
where user_id = '22000000-0000-0000-0000-000000000001'
  and display_order = 0;

update public.profile_top_guns
set
  image_cloudinary_url = null,
  image_cloudinary_secure_url = null,
  image_cloudinary_public_id = null,
  image_width = null,
  image_height = null
where user_id = '22000000-0000-0000-0000-000000000001'
  and display_order = 3;

do $$
declare
  gun record;
  gun_count integer;
begin
  select *
  into gun
  from public.profile_top_guns
  where user_id = '22000000-0000-0000-0000-000000000001'
    and display_order = 0;

  if gun.image_cloudinary_secure_url is null
    or gun.image_width <> 1200
    or gun.image_height <> 900 then
    raise exception 'replacement image metadata was not stored';
  end if;

  select count(*)
  into gun_count
  from public.profile_top_guns
  where user_id = '22000000-0000-0000-0000-000000000001';

  if gun_count <> 4 then
    raise exception 'expected four top gun records, got %', gun_count;
  end if;

  if exists (
    select 1
    from public.profile_top_guns
    where user_id = '22000000-0000-0000-0000-000000000001'
      and display_order in (1, 3)
      and (
        image_cloudinary_url is not null
        or image_cloudinary_secure_url is not null
        or image_cloudinary_public_id is not null
        or image_width is not null
        or image_height is not null
      )
  ) then
    raise exception 'no-image or removed-image metadata was not cleared';
  end if;
end $$;

reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '22000000-0000-0000-0000-000000000002', false);

do $$
declare
  changed_rows integer;
begin
  update public.profile_top_guns
  set name = 'Unauthorized Change'
  where user_id = '22000000-0000-0000-0000-000000000001';

  get diagnostics changed_rows = row_count;

  if changed_rows <> 0 then
    raise exception 'non-owner updated another user top gun';
  end if;

  begin
    insert into public.profile_top_guns (user_id, name, display_order)
    values (
      '22000000-0000-0000-0000-000000000001',
      'Unauthorized Insert',
      1
    );
    raise exception 'non-owner insert should fail';
  exception
    when insufficient_privilege or check_violation then
      null;
  end;
end $$;

reset role;

set role anon;

do $$
declare
  public_gun record;
  visible_count integer;
begin
  select
    id,
    name,
    display_order,
    image_cloudinary_url,
    image_cloudinary_secure_url,
    image_width,
    image_height
  into public_gun
  from public.profile_top_guns
  where user_id = '22000000-0000-0000-0000-000000000001'
    and display_order = 0;

  if public_gun.id is null
    or public_gun.name <> 'Test Gun One'
    or public_gun.image_cloudinary_secure_url is null then
    raise exception 'visible profile top gun safe display fields were not readable';
  end if;

  select count(*)
  into visible_count
  from public.profile_top_guns
  where user_id = '22000000-0000-0000-0000-000000000001';

  if visible_count <> 4 then
    raise exception 'public viewer should see four safe top gun records';
  end if;
end $$;

reset role;

select 'top gun image tests passed' as result;
