-- Run with psql -v ON_ERROR_STOP=1. All fixtures and temporary helpers roll back.
begin;

create function pg_temp.expect_reply_denied(parent_id uuid, reply_id uuid)
returns void language plpgsql as $$
declare
  before_count bigint;
  rejected boolean := false;
begin
  select count(*) into before_count from public.notifications;
  set local role authenticated;
  begin
    perform public.create_reply_notification(parent_id, reply_id);
  exception when raise_exception then
    if sqlerrm <> 'Reply notification denied' then
      raise exception 'Unexpected or information-leaking error: %', sqlerrm;
    end if;
    rejected := true;
  end;
  reset role;
  if not rejected then raise exception 'Invalid relationship accepted: %, %', parent_id, reply_id; end if;
  if (select count(*) from public.notifications) <> before_count then
    raise exception 'Invalid attempt created notification rows';
  end if;
end;
$$;

do $$
<<test>>
declare
  actor uuid := '00000000-0000-0000-0000-000000009201';
  recipient uuid := '00000000-0000-0000-0000-000000009202';
  outsider uuid := '00000000-0000-0000-0000-000000009203';
  post_id uuid;
  other_post uuid;
  parent_id uuid;
  unrelated_parent uuid;
  cross_post_parent uuid;
  self_parent uuid;
  reply_id uuid;
  self_reply uuid;
  foreign_reply uuid;
  notification_id uuid;
  missing uuid := '00000000-0000-0000-0000-000000009299';
  rejected boolean;
  original_count bigint;
  flag text;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  select id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated',
    'reply-hardening-' || id || '@example.test', '', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
  from unnest(array[actor, recipient, outsider]) as fixtures(id);

  insert into public.posts(user_id,title,body,visibility) values(recipient,'Reply test','body','public') returning id into post_id;
  insert into public.posts(user_id,title,body,visibility) values(outsider,'Other post','body','public') returning id into other_post;
  insert into public.comments(post_id,user_id,body) values(post_id,recipient,'Parent') returning id into parent_id;
  insert into public.comments(post_id,user_id,body) values(post_id,outsider,'Unrelated parent') returning id into unrelated_parent;
  insert into public.comments(post_id,user_id,body) values(other_post,outsider,'Cross-post parent') returning id into cross_post_parent;
  insert into public.comments(post_id,user_id,body) values(post_id,actor,'Self parent') returning id into self_parent;
  insert into public.comments(post_id,user_id,parent_comment_id,body) values(post_id,actor,parent_id,'Reply') returning id into reply_id;
  insert into public.comments(post_id,user_id,parent_comment_id,body) values(post_id,actor,self_parent,'Self reply') returning id into self_reply;
  insert into public.comments(post_id,user_id,parent_comment_id,body) values(post_id,outsider,parent_id,'Other user reply') returning id into foreign_reply;

  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  -- Every invalid call must fail even before there is a valid notification to deduplicate.
  perform pg_temp.expect_reply_denied(unrelated_parent, reply_id);
  perform pg_temp.expect_reply_denied(cross_post_parent, reply_id);
  perform pg_temp.expect_reply_denied(self_parent, reply_id); -- cannot bypass validation through self-suppression
  perform pg_temp.expect_reply_denied(parent_id, self_parent); -- caller-owned top-level comment
  perform pg_temp.expect_reply_denied(parent_id, missing);
  perform pg_temp.expect_reply_denied(missing, reply_id);
  perform pg_temp.expect_reply_denied(parent_id, foreign_reply);
  perform pg_temp.expect_reply_denied(null, reply_id);
  perform pg_temp.expect_reply_denied(parent_id, null);

  update public.comments set is_deleted = true, deleted_at = now() where id = reply_id;
  perform pg_temp.expect_reply_denied(parent_id, reply_id);
  update public.comments set is_deleted = false, deleted_at = null where id = reply_id;
  update public.comments set is_deleted = true, deleted_at = now() where id = parent_id;
  perform pg_temp.expect_reply_denied(parent_id, reply_id);
  update public.comments set is_deleted = false, deleted_at = null where id = parent_id;
  update public.posts set is_deleted = true, deleted_at = now() where id = post_id;
  perform pg_temp.expect_reply_denied(parent_id, reply_id);
  update public.posts set is_deleted = false, deleted_at = null where id = post_id;
  update public.posts set visibility = 'private' where id = post_id;
  perform pg_temp.expect_reply_denied(parent_id, reply_id);
  update public.posts set visibility = 'friends' where id = post_id;
  perform pg_temp.expect_reply_denied(parent_id, reply_id);
  update public.posts set visibility = 'public' where id = post_id;

  -- The existing moderation gate must prevent replaying an older valid reply.
  foreach flag in array array['is_muted','is_banned','is_deleted'] loop
    execute format('update public.profiles set %I = true where id = $1', flag) using actor;
    select count(*) into original_count from public.notifications;
    rejected := false;
    set local role authenticated;
    begin
      perform public.create_reply_notification(parent_id, reply_id);
    exception when raise_exception then rejected := true;
    end;
    reset role;
    if not rejected or (select count(*) from public.notifications) <> original_count then
      raise exception 'Moderation restriction bypassed: %', flag;
    end if;
    execute format('update public.profiles set %I = false where id = $1', flag) using actor;
  end loop;

  set local role authenticated;
  -- Exact named arguments used by both Web and Android remain accepted.
  notification_id := public.create_reply_notification(p_parent_comment_id => parent_id, p_reply_comment_id => reply_id);
  reset role;
  if notification_id is null or not exists (
    select 1 from public.notifications n where n.id = notification_id and n.user_id = recipient
      and n.actor_id = actor and n.post_id = test.post_id and n.comment_id = reply_id and n.type = 'reply'
      and n.metadata->>'parent_comment_id' = parent_id::text
  ) then raise exception 'Valid reply notification contents incorrect'; end if;

  select count(*) into original_count from public.notifications;
  set local role authenticated;
  if public.create_reply_notification(parent_id, reply_id) is not null then raise exception 'Duplicate not suppressed'; end if;
  if public.create_reply_notification(self_parent, self_reply) is not null then raise exception 'Self-reply not suppressed'; end if;
  reset role;
  if (select count(*) from public.notifications) <> original_count then raise exception 'Suppressed attempts created rows'; end if;

  delete from public.notifications where id = notification_id;
  update public.notification_settings set comments_enabled = false where user_id = recipient;
  set local role authenticated;
  if public.create_reply_notification(parent_id, reply_id) is not null then raise exception 'Preferences ignored'; end if;
  reset role;
  if exists (select 1 from public.notifications n where n.comment_id = reply_id) then raise exception 'Preference suppression inserted a row'; end if;
  perform pg_temp.expect_reply_denied(unrelated_parent, reply_id); -- invalid even if recipient has disabled notifications

  if has_function_privilege('anon','public.create_reply_notification(uuid,uuid)','EXECUTE')
    or not has_function_privilege('authenticated','public.create_reply_notification(uuid,uuid)','EXECUTE') then
    raise exception 'RPC execution grants changed';
  end if;
  raise notice 'Reply notification relationship, authorization, suppression and argument compatibility checks passed';
end;
$$;
rollback;
