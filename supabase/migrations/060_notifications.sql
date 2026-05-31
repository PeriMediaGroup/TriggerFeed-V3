-- =========================================================
-- 060: Notifications and Controlled Notification RPCs
-- =========================================================

begin;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,

  type text not null,

  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  friend_id uuid references public.friends(id) on delete cascade,

  title text,
  body text,

  is_read boolean not null default false,
  read_at timestamptz,
  dismissed_at timestamptz,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  constraint notifications_type_check
    check (
      type in (
        'mention',
        'comment',
        'reply',
        'friend_request',
        'friend_accepted',
        'system'
      )
    )
);

create index if not exists notifications_user_id_idx
on public.notifications(user_id);

create index if not exists notifications_user_id_is_read_created_at_idx
on public.notifications(user_id, is_read, created_at desc);

create index if not exists notifications_actor_id_idx
on public.notifications(actor_id);

create index if not exists notifications_post_id_idx
on public.notifications(post_id);

create index if not exists notifications_comment_id_idx
on public.notifications(comment_id);

create unique index if not exists notifications_unique_mention_context_idx
on public.notifications(
  user_id,
  actor_id,
  type,
  post_id,
  coalesce(comment_id, '00000000-0000-0000-0000-000000000000'::uuid)
)
where type = 'mention';

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

alter table public.notifications enable row level security;

revoke all on public.notifications from anon;
revoke all on public.notifications from authenticated;

grant select, update, delete on public.notifications to authenticated;
-- Direct inserts are intentionally blocked. Use RPC helpers below.

create policy "notifications_select_own"
on public.notifications
for select
to authenticated
using (auth.uid() = user_id);

create policy "notifications_update_own"
on public.notifications
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "notifications_delete_own"
on public.notifications
for delete
to authenticated
using (auth.uid() = user_id);

-- ---------------------------------------------------------
-- Notification settings
-- ---------------------------------------------------------

create table if not exists public.notification_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,

  mentions_enabled boolean not null default true,
  comments_enabled boolean not null default true,
  friend_requests_enabled boolean not null default true,
  friend_accepts_enabled boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_settings enable row level security;

revoke all on public.notification_settings from anon;
revoke all on public.notification_settings from authenticated;

grant select, insert, update on public.notification_settings to authenticated;

create policy "notification_settings_select_own"
on public.notification_settings
for select
to authenticated
using (auth.uid() = user_id);

create policy "notification_settings_insert_own"
on public.notification_settings
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "notification_settings_update_own"
on public.notification_settings
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop trigger if exists set_notification_settings_updated_at on public.notification_settings;
create trigger set_notification_settings_updated_at
before update on public.notification_settings
for each row
execute function public.set_updated_at();

insert into public.notification_settings (user_id)
select id
from public.profiles
on conflict (user_id) do nothing;

create or replace function public.create_notification_settings_for_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists create_notification_settings_after_profile_insert on public.profiles;
create trigger create_notification_settings_after_profile_insert
after insert on public.profiles
for each row
execute function public.create_notification_settings_for_profile();

revoke all on function public.create_notification_settings_for_profile() from public;

create or replace function public.should_create_notification(
  p_user_id uuid,
  p_type text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case p_type
    when 'mention' then coalesce((
      select ns.mentions_enabled
      from public.notification_settings ns
      where ns.user_id = p_user_id
    ), true)
    when 'comment' then coalesce((
      select ns.comments_enabled
      from public.notification_settings ns
      where ns.user_id = p_user_id
    ), true)
    when 'reply' then coalesce((
      select ns.comments_enabled
      from public.notification_settings ns
      where ns.user_id = p_user_id
    ), true)
    when 'friend_request' then coalesce((
      select ns.friend_requests_enabled
      from public.notification_settings ns
      where ns.user_id = p_user_id
    ), true)
    when 'friend_accepted' then coalesce((
      select ns.friend_accepts_enabled
      from public.notification_settings ns
      where ns.user_id = p_user_id
    ), true)
    else true
  end;
$$;

revoke all on function public.should_create_notification(uuid, text) from public;

-- ---------------------------------------------------------
-- Mention notification helper
-- Signature expected by app:
-- create_mention_notification(p_user_id, p_post_id, p_comment_id)
-- Actor is derived from auth.uid().
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

  if p_comment_id is null then
    if not exists (
      select 1
      from public.posts p
      where p.id = p_post_id
        and p.user_id = v_actor_id
        and coalesce(p.is_deleted, false) = false
        and p.visibility = 'public'
    ) then
      raise exception 'Mention notification denied: actor does not own post';
    end if;
  else
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

  if not public.should_create_notification(p_user_id, 'mention') then
    return null;
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
    jsonb_build_object('source', case when p_comment_id is null then 'post' else 'comment' end)
  )
  on conflict do nothing
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;

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
    and coalesce(p.is_deleted, false) = false
    and p.visibility = 'public';

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

  if not public.should_create_notification(v_post_owner_id, 'comment') then
    return null;
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

  if not public.should_create_notification(v_parent_owner_id, 'reply') then
    return null;
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
    jsonb_build_object('source', 'reply', 'parent_comment_id', p_parent_comment_id)
  )
  on conflict do nothing
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;

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
  v_requester_id uuid;
  v_recipient_id uuid;
  v_notification_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  select f.requester_id, f.addressee_id
  into v_requester_id, v_recipient_id
  from public.friends f
  where f.id = p_friend_id
    and f.status = 'pending';

  if v_requester_id is null then
    raise exception 'Friend request not found';
  end if;

  if v_requester_id <> v_actor_id then
    raise exception 'Friend request notification denied: actor is not requester';
  end if;

  if v_recipient_id = v_actor_id then
    return null;
  end if;

  if not public.should_create_notification(v_recipient_id, 'friend_request') then
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
  v_requester_id uuid;
  v_recipient_id uuid;
  v_status text;
  v_notification_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  select f.requester_id, f.addressee_id, f.status
  into v_requester_id, v_recipient_id, v_status
  from public.friends f
  where f.id = p_friend_id;

  if v_requester_id is null then
    raise exception 'Friend row not found';
  end if;

  if v_recipient_id <> v_actor_id then
    raise exception 'Friend accepted notification denied: actor is not addressee';
  end if;

  if v_status <> 'accepted' then
    raise exception 'Friend accepted notification denied: friendship is not accepted';
  end if;

  if v_requester_id = v_actor_id then
    return null;
  end if;

  if not public.should_create_notification(v_requester_id, 'friend_accepted') then
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

commit;
