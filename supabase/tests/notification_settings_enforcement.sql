-- Notification settings enforcement smoke test.
--
-- Run after applying migrations to a local Supabase database:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/notification_settings_enforcement.sql
--
-- The script runs in a transaction and rolls back all test data.

begin;

do $$
declare
  v_actor_id uuid := '00000000-0000-0000-0000-000000001001'::uuid;
  v_recipient_id uuid := '00000000-0000-0000-0000-000000001002'::uuid;
  v_other_id uuid := '00000000-0000-0000-0000-000000001003'::uuid;
  v_post_id uuid;
  v_parent_comment_id uuid;
  v_comment_id uuid;
  v_friend_id uuid;
  v_notification_id uuid;
  v_count integer;
begin
  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data
  )
  values
    (
      v_actor_id,
      '00000000-0000-0000-0000-000000000000'::uuid,
      'authenticated',
      'authenticated',
      'notification-settings-actor@example.test',
      crypt('password', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb
    ),
    (
      v_recipient_id,
      '00000000-0000-0000-0000-000000000000'::uuid,
      'authenticated',
      'authenticated',
      'notification-settings-recipient@example.test',
      crypt('password', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb
    ),
    (
      v_other_id,
      '00000000-0000-0000-0000-000000000000'::uuid,
      'authenticated',
      'authenticated',
      'notification-settings-other@example.test',
      crypt('password', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb
    );

  select count(*)
  into v_count
  from public.notification_settings
  where user_id in (v_actor_id, v_recipient_id, v_other_id);

  if v_count <> 3 then
    raise exception 'Expected profile trigger to create 3 notification_settings rows, got %', v_count;
  end if;

  delete from public.notification_settings
  where user_id = v_other_id;

  if public.should_create_notification(v_other_id, 'mention') is not true then
    raise exception 'Expected missing notification_settings row to default to enabled';
  end if;

  update public.notification_settings
  set
    mentions_enabled = false,
    comments_enabled = false,
    friend_requests_enabled = false,
    friend_accepts_enabled = false
  where user_id = v_recipient_id;

  if public.should_create_notification(v_recipient_id, 'mention') is not false then
    raise exception 'Expected disabled mentions_enabled to block mention notifications';
  end if;

  if public.should_create_notification(v_recipient_id, 'comment') is not false then
    raise exception 'Expected disabled comments_enabled to block comment notifications';
  end if;

  if public.should_create_notification(v_recipient_id, 'reply') is not false then
    raise exception 'Expected disabled comments_enabled to block reply notifications';
  end if;

  if public.should_create_notification(v_recipient_id, 'friend_request') is not false then
    raise exception 'Expected disabled friend_requests_enabled to block friend_request notifications';
  end if;

  if public.should_create_notification(v_recipient_id, 'friend_accepted') is not false then
    raise exception 'Expected disabled friend_accepts_enabled to block friend_accepted notifications';
  end if;

  if public.should_create_notification(v_recipient_id, 'moderation_warning') is not true then
    raise exception 'Expected moderation_warning notifications to remain always enabled';
  end if;

  insert into public.posts (user_id, title, body, visibility)
  values (v_actor_id, 'Notification settings smoke post', 'body', 'public')
  returning id into v_post_id;

  perform set_config('request.jwt.claim.sub', v_actor_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  v_notification_id := public.create_mention_notification(v_recipient_id, v_post_id, null);

  if v_notification_id is not null then
    raise exception 'Expected disabled mentions setting to skip mention notification';
  end if;

  update public.notification_settings
  set mentions_enabled = true
  where user_id = v_recipient_id;

  v_notification_id := public.create_mention_notification(v_recipient_id, v_post_id, null);

  if v_notification_id is null then
    raise exception 'Expected enabled mentions setting to create mention notification';
  end if;

  v_notification_id := public.create_mention_notification(v_recipient_id, v_post_id, null);

  if v_notification_id is not null then
    raise exception 'Expected duplicate mention notification to return null via on conflict do nothing';
  end if;

  select count(*)
  into v_count
  from public.notifications
  where user_id = v_recipient_id
    and actor_id = v_actor_id
    and type = 'mention'
    and post_id = v_post_id;

  if v_count <> 1 then
    raise exception 'Expected exactly one mention notification after duplicate attempt, got %', v_count;
  end if;

  insert into public.comments (post_id, user_id, body)
  values (v_post_id, v_actor_id, 'Notification settings smoke comment')
  returning id into v_comment_id;

  update public.notification_settings
  set comments_enabled = true
  where user_id = v_recipient_id;

  update public.posts
  set user_id = v_recipient_id
  where id = v_post_id;

  v_notification_id := public.create_comment_notification(v_post_id, v_comment_id);

  if v_notification_id is null then
    raise exception 'Expected enabled comments setting to create comment notification';
  end if;

  insert into public.comments (post_id, user_id, body)
  values (v_post_id, v_recipient_id, 'Notification settings smoke parent comment')
  returning id into v_parent_comment_id;

  insert into public.comments (post_id, user_id, parent_comment_id, body)
  values (v_post_id, v_actor_id, v_parent_comment_id, 'Notification settings smoke reply')
  returning id into v_comment_id;

  v_notification_id := public.create_reply_notification(v_parent_comment_id, v_comment_id);

  if v_notification_id is null then
    raise exception 'Expected enabled comments setting to create reply notification';
  end if;

  update public.notification_settings
  set friend_requests_enabled = false
  where user_id = v_recipient_id;

  insert into public.friends (requester_id, addressee_id, status)
  values (v_actor_id, v_recipient_id, 'pending')
  returning id into v_friend_id;

  v_notification_id := public.create_friend_request_notification(v_friend_id);

  if v_notification_id is not null then
    raise exception 'Expected disabled friend_requests setting to skip friend_request notification';
  end if;

  update public.notification_settings
  set friend_requests_enabled = true
  where user_id = v_recipient_id;

  v_notification_id := public.create_friend_request_notification(v_friend_id);

  if v_notification_id is null then
    raise exception 'Expected enabled friend_requests setting to create friend_request notification';
  end if;

  v_notification_id := public.create_friend_request_notification(v_friend_id);

  if v_notification_id is not null then
    raise exception 'Expected duplicate friend_request notification to return null via on conflict do nothing';
  end if;

  update public.friends
  set status = 'accepted'
  where id = v_friend_id;

  perform set_config('request.jwt.claim.sub', v_recipient_id::text, true);

  update public.notification_settings
  set friend_accepts_enabled = false
  where user_id = v_actor_id;

  v_notification_id := public.create_friend_accepted_notification(v_friend_id);

  if v_notification_id is not null then
    raise exception 'Expected disabled friend_accepts setting to skip friend_accepted notification';
  end if;

  update public.notification_settings
  set friend_accepts_enabled = true
  where user_id = v_actor_id;

  v_notification_id := public.create_friend_accepted_notification(v_friend_id);

  if v_notification_id is null then
    raise exception 'Expected enabled friend_accepts setting to create friend_accepted notification';
  end if;

  v_notification_id := public.create_friend_accepted_notification(v_friend_id);

  if v_notification_id is not null then
    raise exception 'Expected duplicate friend_accepted notification to return null via on conflict do nothing';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000001001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
declare
  v_count integer;
begin
  select count(*)
  into v_count
  from public.notification_settings;

  if v_count <> 1 then
    raise exception 'Expected authenticated user to read only their own notification_settings row, got %', v_count;
  end if;

  update public.notification_settings
  set mentions_enabled = true
  where user_id = '00000000-0000-0000-0000-000000001002'::uuid;

  get diagnostics v_count = row_count;

  if v_count <> 0 then
    raise exception 'Expected authenticated user update of another user settings row to affect 0 rows, got %', v_count;
  end if;

  begin
    insert into public.notification_settings (user_id)
    values ('00000000-0000-0000-0000-000000001003'::uuid)
    on conflict (user_id) do update set mentions_enabled = excluded.mentions_enabled;

    raise exception 'Expected authenticated user insert/upsert for another user to be blocked';
  exception
    when insufficient_privilege then
      null;
  end;
end;
$$;

do $$
begin
  insert into public.notifications (user_id, actor_id, type, title)
  values (
    '00000000-0000-0000-0000-000000001001'::uuid,
    '00000000-0000-0000-0000-000000001002'::uuid,
    'system',
    'Direct insert should be blocked'
  );

  raise exception 'Expected direct insert into notifications to be blocked';
exception
  when insufficient_privilege then
    null;
end;
$$;

rollback;
