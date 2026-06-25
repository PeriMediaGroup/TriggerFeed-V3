-- Focused moderation tiering and CEO role-change RPC tests.
-- Run after local reset:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/moderation_tiering_role_changes.sql

create extension if not exists pgcrypto;

do $$
declare
  ceo_id uuid := '23000000-0000-0000-0000-000000000001';
  admin_id uuid := '23000000-0000-0000-0000-000000000002';
  moderator_id uuid := '23000000-0000-0000-0000-000000000003';
  user_id uuid := '23000000-0000-0000-0000-000000000004';
  post_id uuid := '23000000-0000-0000-0000-000000000005';
  report_id uuid;
begin
  delete from auth.users
  where id in (ceo_id, admin_id, moderator_id, user_id);

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
      ceo_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'tier-ceo@example.com',
      crypt('testMe123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"username":"tier_ceo"}'::jsonb,
      now(),
      now()
    ),
    (
      admin_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'tier-admin@example.com',
      crypt('testMe123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"username":"tier_admin"}'::jsonb,
      now(),
      now()
    ),
    (
      moderator_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'tier-moderator@example.com',
      crypt('testMe123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"username":"tier_moderator"}'::jsonb,
      now(),
      now()
    ),
    (
      user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'tier-user@example.com',
      crypt('testMe123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"username":"tier_user"}'::jsonb,
      now(),
      now()
    );

  update public.profiles set role = 'ceo' where id = ceo_id;
  update public.profiles set role = 'admin' where id = admin_id;
  update public.profiles set role = 'moderator' where id = moderator_id;
  update public.profiles set role = 'user' where id = user_id;

  insert into public.posts (id, user_id, title, body)
  values (post_id, user_id, 'Tiered moderation post', 'Reported body')
  on conflict (id) do update
  set is_deleted = false,
      deleted_at = null,
      removed_at = null,
      removed_by = null,
      removal_reason = null;

  insert into public.post_reports (post_id, reporter_id, reason, status)
  values (post_id, moderator_id, 'spam', 'open')
  on conflict (post_id, reporter_id) do update
  set status = 'open'
  returning id into report_id;
end $$;

set role authenticated;

select set_config('request.jwt.claim.sub', '23000000-0000-0000-0000-000000000004', false);

do $$
begin
  begin
    perform public.change_user_role(
      '23000000-0000-0000-0000-000000000004',
      'moderator',
      'user should fail'
    );
  exception
    when raise_exception then
      if sqlerrm <> 'CEO permission required' then
        raise;
      end if;
      return;
  end;

  raise exception 'normal user should not change roles';
end $$;

select set_config('request.jwt.claim.sub', '23000000-0000-0000-0000-000000000003', false);

do $$
begin
  begin
    perform public.change_user_role(
      '23000000-0000-0000-0000-000000000004',
      'admin',
      'moderator should fail'
    );
  exception
    when raise_exception then
      if sqlerrm <> 'CEO permission required' then
        raise;
      end if;
      return;
  end;

  raise exception 'moderator should not change roles';
end $$;

do $$
begin
  begin
    perform public.moderation_mute_user(
      '23000000-0000-0000-0000-000000000004',
      'moderator mute should fail',
      null,
      null,
      null
    );
  exception
    when raise_exception then
      if sqlerrm <> 'Admin permission required' then
        raise;
      end if;
      return;
  end;

  raise exception 'moderator should not directly mute';
end $$;

do $$
declare
  action_id uuid;
begin
  action_id := public.moderation_warn_user(
    '23000000-0000-0000-0000-000000000004',
    'warning reason',
    'warning message',
    '23000000-0000-0000-0000-000000000005',
    null
  );

  if action_id is null then
    raise exception 'moderator warning did not write an action';
  end if;
end $$;

do $$
declare
  action_id uuid;
begin
  action_id := public.moderation_remove_post(
    '23000000-0000-0000-0000-000000000005',
    'remove reported post',
    null
  );

  if action_id is null then
    raise exception 'moderator remove post did not write an action';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '23000000-0000-0000-0000-000000000002', false);

do $$
begin
  begin
    perform public.change_user_role(
      '23000000-0000-0000-0000-000000000004',
      'moderator',
      'admin should fail'
    );
  exception
    when raise_exception then
      if sqlerrm <> 'CEO permission required' then
        raise;
      end if;
      return;
  end;

  raise exception 'admin should not change roles';
end $$;

do $$
begin
  perform public.moderation_mute_user(
    '23000000-0000-0000-0000-000000000004',
    'admin mute',
    null,
    null,
    null
  );

  if not exists (
    select 1
    from public.profiles
    where id = '23000000-0000-0000-0000-000000000004'
      and is_muted = true
  ) then
    raise exception 'admin mute did not update target';
  end if;
end $$;

do $$
begin
  begin
    perform public.moderation_ban_user(
      '23000000-0000-0000-0000-000000000004',
      'admin ban should fail',
      null,
      null,
      null
    );
  exception
    when raise_exception then
      if sqlerrm <> 'CEO permission required' then
        raise;
      end if;
      return;
  end;

  raise exception 'admin should not permanently ban';
end $$;

select set_config('request.jwt.claim.sub', '23000000-0000-0000-0000-000000000001', false);

do $$
begin
  begin
    perform public.change_user_role(
      '23000000-0000-0000-0000-000000000004',
      'ceo',
      'ceo assignment should fail'
    );
  exception
    when raise_exception then
      if sqlerrm <> 'Invalid target role' then
        raise;
      end if;
      return;
  end;

  raise exception 'CEO assignment should be rejected';
end $$;

do $$
begin
  begin
    perform public.change_user_role(
      '23000000-0000-0000-0000-000000000001',
      'admin',
      'self demotion should fail'
    );
  exception
    when raise_exception then
      if sqlerrm <> 'You cannot change your own role' then
        raise;
      end if;
      return;
  end;

  raise exception 'CEO should not change own role';
end $$;

do $$
declare
  action_id uuid;
begin
  update public.profiles
  set role = 'user'
  where id = '23000000-0000-0000-0000-000000000004';

  action_id := public.change_user_role(
    '23000000-0000-0000-0000-000000000004',
    'moderator',
    'promote for beta moderation'
  );

  if action_id is null then
    raise exception 'CEO role change did not return an audit action';
  end if;

  if not exists (
    select 1
    from public.moderation_actions
    where id = action_id
      and target_user_id = '23000000-0000-0000-0000-000000000004'
      and actor_user_id = '23000000-0000-0000-0000-000000000001'
      and action_type = 'role_changed'
      and reason = 'promote for beta moderation'
      and metadata->>'old_role' = 'user'
      and metadata->>'new_role' = 'moderator'
  ) then
    raise exception 'role change audit row was not written correctly';
  end if;

  perform public.change_user_role(
    '23000000-0000-0000-0000-000000000004',
    'admin',
    'promote to admin'
  );

  perform public.change_user_role(
    '23000000-0000-0000-0000-000000000004',
    'user',
    'restore normal user'
  );
end $$;

do $$
begin
  perform public.moderation_ban_user(
    '23000000-0000-0000-0000-000000000004',
    'ceo final ban',
    null,
    null,
    null
  );

  perform public.moderation_unban_user(
    '23000000-0000-0000-0000-000000000004',
    'ceo unban'
  );

  if exists (
    select 1
    from public.profiles
    where id = '23000000-0000-0000-0000-000000000004'
      and is_banned = true
  ) then
    raise exception 'CEO unban did not update target';
  end if;
end $$;

reset role;

select 'moderation tiering and role change tests passed' as result;
