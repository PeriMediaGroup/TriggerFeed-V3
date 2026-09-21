-- =========================================================
-- Specialized Creator and Organization signup profiles
-- =========================================================

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dob date;
  v_age_gate_version text;
  v_birthday_messages_enabled boolean;
  v_marketing_visitor_id uuid;
  v_profile_type text;
  v_profile_metadata jsonb;
begin
  begin
    if new.raw_user_meta_data ? 'dob'
      and (new.raw_user_meta_data->>'dob') ~ '^\d{4}-\d{2}-\d{2}$'
    then
      v_dob := (new.raw_user_meta_data->>'dob')::date;
    end if;
  exception
    when others then
      v_dob := null;
  end;

  begin
    if new.raw_user_meta_data ? 'marketing_visitor_id'
      and (new.raw_user_meta_data->>'marketing_visitor_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then
      v_marketing_visitor_id := (new.raw_user_meta_data->>'marketing_visitor_id')::uuid;
    end if;
  exception
    when others then
      v_marketing_visitor_id := null;
  end;

  v_age_gate_version := nullif(trim(coalesce(new.raw_user_meta_data->>'age_gate_version', '')), '');
  v_birthday_messages_enabled := coalesce(
    case
      when lower(coalesce(new.raw_user_meta_data->>'birthday_messages_enabled', '')) in ('true', 't', '1', 'yes') then true
      when lower(coalesce(new.raw_user_meta_data->>'birthday_messages_enabled', '')) in ('false', 'f', '0', 'no') then false
      else null
    end,
    true
  );

  -- Client metadata can request only the two public specialized types.
  -- member is the safe default; system and authorization roles are never client-controlled.
  v_profile_type := case
    when new.raw_user_meta_data->>'profile_type' in ('creator', 'organization')
      then new.raw_user_meta_data->>'profile_type'
    else 'member'
  end;

  if jsonb_typeof(new.raw_user_meta_data->'profile_metadata') = 'object'
    and v_profile_type in ('creator', 'organization')
  then
    v_profile_metadata := new.raw_user_meta_data->'profile_metadata';
  else
    v_profile_metadata := '{}'::jsonb;
  end if;

  insert into public.profiles (
    id,
    email,
    username,
    display_name,
    first_name,
    last_name,
    bio,
    profile_type,
    dob,
    age_verified_at,
    age_gate_version,
    birthday_messages_enabled,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data->>'username', ''),
    left(nullif(new.raw_user_meta_data->>'display_name', ''), 120),
    nullif(new.raw_user_meta_data->>'first_name', ''),
    nullif(new.raw_user_meta_data->>'last_name', ''),
    left(nullif(new.raw_user_meta_data->>'bio', ''), 500),
    v_profile_type,
    case when public.is_adult_dob(v_dob) then v_dob else null end,
    case when public.is_adult_dob(v_dob) then now() else null end,
    coalesce(v_age_gate_version, 'v1'),
    v_birthday_messages_enabled,
    now(),
    now()
  )
  on conflict (id) do update
  set
    email = excluded.email,
    dob = coalesce(public.profiles.dob, excluded.dob),
    age_verified_at = coalesce(public.profiles.age_verified_at, excluded.age_verified_at),
    age_gate_version = coalesce(nullif(public.profiles.age_gate_version, ''), excluded.age_gate_version, 'v1'),
    birthday_messages_enabled = coalesce(public.profiles.birthday_messages_enabled, excluded.birthday_messages_enabled, true),
    updated_at = now();

  if v_profile_type in ('creator', 'organization') then
    insert into public.profile_metadata (
      user_id,
      category,
      subtype,
      website_url,
      primary_link_url,
      primary_link_label,
      social_links,
      public_contact_email,
      public_contact_phone,
      public_location
    )
    values (
      new.id,
      left(nullif(trim(v_profile_metadata->>'category'), ''), 80),
      left(nullif(trim(v_profile_metadata->>'subtype'), ''), 80),
      left(nullif(trim(v_profile_metadata->>'website_url'), ''), 500),
      left(nullif(trim(v_profile_metadata->>'primary_link_url'), ''), 500),
      left(nullif(trim(v_profile_metadata->>'primary_link_label'), ''), 80),
      case when jsonb_typeof(v_profile_metadata->'social_links') = 'array'
        then v_profile_metadata->'social_links' else '[]'::jsonb end,
      left(nullif(trim(v_profile_metadata->>'public_contact_email'), ''), 254),
      left(nullif(trim(v_profile_metadata->>'public_contact_phone'), ''), 40),
      left(nullif(trim(v_profile_metadata->>'public_location'), ''), 120)
    )
    on conflict (user_id) do nothing;
  end if;

  perform public.record_user_referral_from_code(
    new.id,
    new.raw_user_meta_data->>'referral_code'
  );

  begin
    perform public.associate_marketing_visitor_with_user(
      v_marketing_visitor_id,
      new.id
    );
  exception
    when others then
      raise warning 'Marketing attribution association failed for user %: %',
        new.id,
        sqlerrm;
  end;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

comment on function public.handle_new_user() is
  'Creates a member profile by default, or a public creator/organization profile from the specialized signup flow. Client metadata cannot select system or authorization roles.';

commit;
