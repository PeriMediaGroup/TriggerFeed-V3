-- =========================================================
-- Stage 7.1: Notification Security + Helper RPCs
-- Builds on 070_stage_7_notifications.sql
--
-- Goal:
-- - Users can read/update/delete their own notifications.
-- - Users CANNOT directly insert fake/spoofed notifications.
-- - Notifications are created through controlled RPC helpers.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Remove direct authenticated inserts
-- ---------------------------------------------------------

revoke insert on public.notifications from authenticated;

drop policy if exists "Authenticated users can create notifications"
on public.notifications;


-- ---------------------------------------------------------
-- 2. Extra duplicate protection indexes
-- ---------------------------------------------------------

create unique index if not exists notifications_unique_comment_context_idx
on public.notifications (
  user_id,
  actor_id,
  type,
  comment_id
)
where type in ('comment', 'reply')
and comment_id is not null;

create unique index if not exists notifications_unique_friend_context_idx
on public.notifications (
  user_id,
  actor_id,
  type,
  friend_id
)
where type in ('friend_request', 'friend_accepted')
and friend_id is not null;


-- ---------------------------------------------------------
-- 3. Mention notification helper
--
-- Use this when:
-- - someone mentions a user in a post
-- - someone mentions a user in a comment
--
-- Security:
-- - actor_id is always auth.uid()
-- - actor must own the post or comment that caused the mention
-- - users cannot notify themselves
-- ---------------------------------------------------------

create or replace function public.create_mention_notification(
  p_user_id uuid,
  p_post_id uuid,
  p_comment_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_notification_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_user_id is null then
    raise exception 'Missing notification user_id';
  end if;

  if p_user_id = v_actor_id then
    return null;
  end if;

  -- Mention in a post.
  if p_comment_id is null then
    if not exists (
      select 1
      from public.posts p
      where p.id = p_post_id
        and p.user_id = v_actor_id
        and coalesce(p.is_deleted, false) = false
    ) then
      raise exception 'Mention notification denied: actor does not own post';
    end if;
  end if;

  -- Mention in a comment.
  if p_comment_id is not null then
    if not exists (
      select 1
      from public.comments c
      where c.id = p_comment_id
        and c.post_id = p_post_id
        and c.user_id = v_actor_id
        and coalesce(c.is_deleted, false) = false
    ) then
      raise exception 'Mention notification denied: actor does not own comment';
    end if;
  end if;

  insert into public.notifications (
    user_id,
    actor_id,
    type,
    post_id,
    comment_id,
    title,
    body,
    metadata
  )
  values (
    p_user_id,
    v_actor_id,
    'mention',
    p_post_id,
    p_comment_id,
    'You were mentioned',
    case
      when p_comment_id is null then 'mentioned you in a post'
      else 'mentioned you in a comment'
    end,
    jsonb_build_object(
      'source', case when p_comment_id is null then 'post' else 'comment' end
    )
  )
  on conflict do nothing
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;


-- ---------------------------------------------------------
-- 4. Comment notification helper
--
-- Use this when:
-- - someone comments on another user’s post
--
-- Security:
-- - actor must own the comment
-- - recipient is derived from the post owner
-- - users cannot notify themselves
-- ---------------------------------------------------------

create or replace function public.create_comment_notification(
  p_post_id uuid,
  p_comment_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_post_owner_id uuid;
  v_notification_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  select p.user_id
  into v_post_owner_id
  from public.posts p
  where p.id = p_post_id
    and coalesce(p.is_deleted, false) = false;

  if v_post_owner_id is null then
    raise exception 'Post not found';
  end if;

  if v_post_owner_id = v_actor_id then
    return null;
  end if;

  if not exists (
    select 1
    from public.comments c
    where c.id = p_comment_id
      and c.post_id = p_post_id
      and c.user_id = v_actor_id
      and coalesce(c.is_deleted, false) = false
  ) then
    raise exception 'Comment notification denied: actor does not own comment';
  end if;

  insert into public.notifications (
    user_id,
    actor_id,
    type,
    post_id,
    comment_id,
    title,
    body,
    metadata
  )
  values (
    v_post_owner_id,
    v_actor_id,
    'comment',
    p_post_id,
    p_comment_id,
    'New comment',
    'commented on your post',
    jsonb_build_object('source', 'comment')
  )
  on conflict do nothing
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;


-- ---------------------------------------------------------
-- 5. Reply notification helper
--
-- Use this when:
-- - someone replies to another user’s comment
--
-- Security:
-- - actor must own the reply comment
-- - recipient is derived from the parent comment owner
-- - users cannot notify themselves
-- ---------------------------------------------------------

create or replace function public.create_reply_notification(
  p_parent_comment_id uuid,
  p_reply_comment_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_parent_owner_id uuid;
  v_post_id uuid;
  v_notification_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  select c.user_id, c.post_id
  into v_parent_owner_id, v_post_id
  from public.comments c
  where c.id = p_parent_comment_id
    and coalesce(c.is_deleted, false) = false;

  if v_parent_owner_id is null then
    raise exception 'Parent comment not found';
  end if;

  if v_parent_owner_id = v_actor_id then
    return null;
  end if;

  if not exists (
    select 1
    from public.comments c
    where c.id = p_reply_comment_id
      and c.post_id = v_post_id
      and c.user_id = v_actor_id
      and coalesce(c.is_deleted, false) = false
  ) then
    raise exception 'Reply notification denied: actor does not own reply';
  end if;

  insert into public.notifications (
    user_id,
    actor_id,
    type,
    post_id,
    comment_id,
    title,
    body,
    metadata
  )
  values (
    v_parent_owner_id,
    v_actor_id,
    'reply',
    v_post_id,
    p_reply_comment_id,
    'New reply',
    'replied to your comment',
    jsonb_build_object(
      'source', 'reply',
      'parent_comment_id', p_parent_comment_id
    )
  )
  on conflict do nothing
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;


-- ---------------------------------------------------------
-- 6. Friend request notification helper
--
-- This is intentionally flexible for friend table naming.
-- It supports common friendship columns:
-- - requester_id / addressee_id
-- - sender_id / receiver_id
-- - user_id / friend_user_id
-- - user_id / friend_id
--
-- Security:
-- - actor must be the requester/sender/user side
-- - recipient is derived from the friend row
-- ---------------------------------------------------------

create or replace function public.create_friend_request_notification(
  p_friend_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_friend_row jsonb;
  v_requester_id uuid;
  v_recipient_id uuid;
  v_notification_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  select to_jsonb(f)
  into v_friend_row
  from public.friends f
  where f.id = p_friend_id;

  if v_friend_row is null then
    raise exception 'Friend request not found';
  end if;

  v_requester_id := coalesce(
    nullif(v_friend_row ->> 'requester_id', '')::uuid,
    nullif(v_friend_row ->> 'sender_id', '')::uuid,
    nullif(v_friend_row ->> 'user_id', '')::uuid
  );

  v_recipient_id := coalesce(
    nullif(v_friend_row ->> 'addressee_id', '')::uuid,
    nullif(v_friend_row ->> 'receiver_id', '')::uuid,
    nullif(v_friend_row ->> 'recipient_id', '')::uuid,
    nullif(v_friend_row ->> 'friend_user_id', '')::uuid,
    nullif(v_friend_row ->> 'friend_id', '')::uuid
  );

  if v_requester_id is null or v_recipient_id is null then
    raise exception 'Friend row does not contain supported requester/recipient columns';
  end if;

  if v_requester_id <> v_actor_id then
    raise exception 'Friend request notification denied: actor is not requester';
  end if;

  if v_recipient_id = v_actor_id then
    return null;
  end if;

  insert into public.notifications (
    user_id,
    actor_id,
    type,
    friend_id,
    title,
    body,
    metadata
  )
  values (
    v_recipient_id,
    v_actor_id,
    'friend_request',
    p_friend_id,
    'New friend request',
    'sent you a friend request',
    jsonb_build_object('source', 'friend_request')
  )
  on conflict do nothing
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;


-- ---------------------------------------------------------
-- 7. Friend accepted notification helper
--
-- Security:
-- - actor must be the recipient/addressee/receiver side
-- - notification goes to the original requester
-- ---------------------------------------------------------

create or replace function public.create_friend_accepted_notification(
  p_friend_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_friend_row jsonb;
  v_requester_id uuid;
  v_recipient_id uuid;
  v_status text;
  v_notification_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  select to_jsonb(f)
  into v_friend_row
  from public.friends f
  where f.id = p_friend_id;

  if v_friend_row is null then
    raise exception 'Friend row not found';
  end if;

  v_requester_id := coalesce(
    nullif(v_friend_row ->> 'requester_id', '')::uuid,
    nullif(v_friend_row ->> 'sender_id', '')::uuid,
    nullif(v_friend_row ->> 'user_id', '')::uuid
  );

  v_recipient_id := coalesce(
    nullif(v_friend_row ->> 'addressee_id', '')::uuid,
    nullif(v_friend_row ->> 'receiver_id', '')::uuid,
    nullif(v_friend_row ->> 'recipient_id', '')::uuid,
    nullif(v_friend_row ->> 'friend_user_id', '')::uuid,
    nullif(v_friend_row ->> 'friend_id', '')::uuid
  );

  v_status := lower(coalesce(v_friend_row ->> 'status', ''));

  if v_requester_id is null or v_recipient_id is null then
    raise exception 'Friend row does not contain supported requester/recipient columns';
  end if;

  if v_recipient_id <> v_actor_id then
    raise exception 'Friend accepted notification denied: actor is not recipient';
  end if;

  -- If your friends table has no status column, this quietly allows it.
  -- If it does have status, we only allow accepted/active/friends.
  if v_status <> ''
    and v_status not in ('accepted', 'active', 'friends', 'friend')
  then
    raise exception 'Friend accepted notification denied: friendship is not accepted';
  end if;

  if v_requester_id = v_actor_id then
    return null;
  end if;

  insert into public.notifications (
    user_id,
    actor_id,
    type,
    friend_id,
    title,
    body,
    metadata
  )
  values (
    v_requester_id,
    v_actor_id,
    'friend_accepted',
    p_friend_id,
    'Friend request accepted',
    'accepted your friend request',
    jsonb_build_object('source', 'friend_accepted')
  )
  on conflict do nothing
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;


-- ---------------------------------------------------------
-- 8. Allow authenticated users to call the helpers
-- ---------------------------------------------------------

revoke all on function public.create_mention_notification(uuid, uuid, uuid) from public;
revoke all on function public.create_comment_notification(uuid, uuid) from public;
revoke all on function public.create_reply_notification(uuid, uuid) from public;
revoke all on function public.create_friend_request_notification(uuid) from public;
revoke all on function public.create_friend_accepted_notification(uuid) from public;

grant execute on function public.create_mention_notification(uuid, uuid, uuid) to authenticated;
grant execute on function public.create_comment_notification(uuid, uuid) to authenticated;
grant execute on function public.create_reply_notification(uuid, uuid) to authenticated;
grant execute on function public.create_friend_request_notification(uuid) to authenticated;
grant execute on function public.create_friend_accepted_notification(uuid) to authenticated;