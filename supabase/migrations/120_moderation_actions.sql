-- =========================================================
-- 120: Moderation Actions
-- =========================================================

begin;

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('user', 'moderator', 'admin', 'ceo'));

create or replace function public.is_moderator_or_above()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('moderator', 'admin', 'ceo')
      and coalesce(p.is_banned, false) = false
      and coalesce(p.is_deleted, false) = false
  );
$$;

create or replace function public.is_admin_or_above()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'ceo')
      and coalesce(p.is_banned, false) = false
      and coalesce(p.is_deleted, false) = false
  );
$$;

create or replace function public.is_ceo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'ceo'
      and coalesce(p.is_banned, false) = false
      and coalesce(p.is_deleted, false) = false
  );
$$;

revoke all on function public.is_moderator_or_above() from public;
revoke all on function public.is_admin_or_above() from public;
revoke all on function public.is_ceo() from public;
grant execute on function public.is_moderator_or_above() to authenticated;
grant execute on function public.is_admin_or_above() to authenticated;
grant execute on function public.is_ceo() to authenticated;

create or replace function public.get_moderation_profile_cards(p_profile_ids uuid[])
returns table (
  id uuid,
  username text,
  display_name text,
  first_name text,
  last_name text,
  avatar_cloudinary_url text,
  profile_badge text,
  role text,
  is_banned boolean,
  is_muted boolean,
  is_deleted boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.username,
    p.display_name,
    p.first_name,
    p.last_name,
    p.avatar_cloudinary_url,
    p.profile_badge,
    p.role,
    coalesce(p.is_banned, false) as is_banned,
    coalesce(p.is_muted, false) as is_muted,
    coalesce(p.is_deleted, false) as is_deleted
  from public.profiles p
  where p.id = any(p_profile_ids)
    and public.is_moderator_or_above();
$$;

revoke all on function public.get_moderation_profile_cards(uuid[]) from public;
grant execute on function public.get_moderation_profile_cards(uuid[]) to authenticated;

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid references public.profiles(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  related_post_id uuid references public.posts(id) on delete set null,
  related_report_id uuid references public.post_reports(id) on delete set null,
  action_type text not null,
  reason text,
  message text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),

  constraint moderation_actions_action_type_check
    check (
      action_type in (
        'warn',
        'mute',
        'unmute',
        'ban',
        'unban',
        'remove_post',
        'restore_post',
        'dismiss_report',
        'review_report',
        'admin_note',
        'promote_user',
        'demote_user'
      )
    ),

  constraint moderation_actions_target_or_related_required_check
    check (
      target_user_id is not null
      or related_post_id is not null
      or related_report_id is not null
    )
);

create index if not exists moderation_actions_target_user_id_idx
  on public.moderation_actions(target_user_id);

create index if not exists moderation_actions_actor_user_id_idx
  on public.moderation_actions(actor_user_id);

create index if not exists moderation_actions_related_post_id_idx
  on public.moderation_actions(related_post_id);

create index if not exists moderation_actions_related_report_id_idx
  on public.moderation_actions(related_report_id);

create index if not exists moderation_actions_action_type_idx
  on public.moderation_actions(action_type);

create index if not exists moderation_actions_created_at_idx
  on public.moderation_actions(created_at desc);

alter table public.moderation_actions enable row level security;

revoke all on public.moderation_actions from anon;
revoke all on public.moderation_actions from authenticated;
grant select, insert on public.moderation_actions to authenticated;

drop policy if exists "moderation_actions_select_moderators"
on public.moderation_actions;

create policy "moderation_actions_select_moderators"
on public.moderation_actions
for select
to authenticated
using (public.is_moderator_or_above());

drop policy if exists "moderation_actions_insert_moderators"
on public.moderation_actions;

create policy "moderation_actions_insert_moderators"
on public.moderation_actions
for insert
to authenticated
with check (
  actor_user_id = auth.uid()
  and (
    (
      action_type in (
        'warn',
        'mute',
        'unmute',
        'remove_post',
        'restore_post',
        'dismiss_report',
        'review_report',
        'admin_note'
      )
      and public.is_moderator_or_above()
    )
    or (
      action_type in ('ban', 'unban')
      and public.is_admin_or_above()
    )
    or (
      action_type in ('promote_user', 'demote_user')
      and public.is_ceo()
    )
  )
);

drop policy if exists "Admins and CEO can read all post reports"
on public.post_reports;

create policy "Moderators and above can read all post reports"
on public.post_reports
for select
to authenticated
using (public.is_moderator_or_above());

drop policy if exists "Admins and CEO can update post reports"
on public.post_reports;

create policy "Moderators and above can update post reports"
on public.post_reports
for update
to authenticated
using (public.is_moderator_or_above())
with check (public.is_moderator_or_above());

drop policy if exists "posts_insert_own_public"
on public.posts;

create policy "posts_insert_own_public"
on public.posts
for insert
to authenticated
with check (
  auth.uid() = user_id
  and visibility = 'public'
  and is_deleted = false
  and deleted_at is null
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.is_banned, false) = false
      and coalesce(p.is_muted, false) = false
      and coalesce(p.is_deleted, false) = false
  )
);

drop policy if exists "comments_insert_own_visible_public_post"
on public.comments;

create policy "comments_insert_own_visible_public_post"
on public.comments
for insert
to authenticated
with check (
  auth.uid() = user_id
  and is_deleted = false
  and deleted_at is null
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.is_banned, false) = false
      and coalesce(p.is_muted, false) = false
      and coalesce(p.is_deleted, false) = false
  )
  and exists (
    select 1
    from public.posts p
    where p.id = comments.post_id
      and p.is_deleted = false
      and p.visibility = 'public'
  )
);

drop policy if exists "friends_insert_pending_only_by_requester"
on public.friends;

create policy "friends_insert_pending_only_by_requester"
on public.friends
for insert
to authenticated
with check (
  auth.uid() = requester_id
  and requester_id <> addressee_id
  and status = 'pending'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.is_banned, false) = false
      and coalesce(p.is_muted, false) = false
      and coalesce(p.is_deleted, false) = false
  )
);

create or replace function public.moderation_assert_target_profile(
  p_target_user_id uuid
)
returns table (
  id uuid,
  role text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select p.id, p.role
  from public.profiles p
  where p.id = p_target_user_id
    and coalesce(p.is_deleted, false) = false
  limit 1;
end;
$$;

revoke all on function public.moderation_assert_target_profile(uuid) from public;

create or replace function public.moderation_warn_user(
  p_target_user_id uuid,
  p_reason text,
  p_message text default null,
  p_related_post_id uuid default null,
  p_related_report_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action_id uuid;
begin
  if not public.is_moderator_or_above() then
    raise exception 'Moderator permission required';
  end if;

  if not exists (select 1 from public.moderation_assert_target_profile(p_target_user_id)) then
    raise exception 'Target user not found';
  end if;

  insert into public.moderation_actions (
    target_user_id,
    actor_user_id,
    related_post_id,
    related_report_id,
    action_type,
    reason,
    message
  )
  values (
    p_target_user_id,
    auth.uid(),
    p_related_post_id,
    p_related_report_id,
    'warn',
    nullif(trim(coalesce(p_reason, '')), ''),
    nullif(trim(coalesce(p_message, '')), '')
  )
  returning id into v_action_id;

  return v_action_id;
end;
$$;

create or replace function public.moderation_mute_user(
  p_target_user_id uuid,
  p_reason text,
  p_expires_at timestamptz default null,
  p_related_post_id uuid default null,
  p_related_report_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target record;
  v_action_id uuid;
begin
  if not public.is_moderator_or_above() then
    raise exception 'Moderator permission required';
  end if;

  select * into v_target
  from public.moderation_assert_target_profile(p_target_user_id)
  limit 1;

  if v_target.id is null then
    raise exception 'Target user not found';
  end if;

  if p_target_user_id = auth.uid() or v_target.role in ('admin', 'ceo') then
    raise exception 'You cannot mute this user';
  end if;

  update public.profiles
  set is_muted = true,
      updated_at = now()
  where id = p_target_user_id;

  insert into public.moderation_actions (
    target_user_id,
    actor_user_id,
    related_post_id,
    related_report_id,
    action_type,
    reason,
    expires_at
  )
  values (
    p_target_user_id,
    auth.uid(),
    p_related_post_id,
    p_related_report_id,
    'mute',
    nullif(trim(coalesce(p_reason, '')), ''),
    p_expires_at
  )
  returning id into v_action_id;

  return v_action_id;
end;
$$;

create or replace function public.moderation_unmute_user(
  p_target_user_id uuid,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action_id uuid;
begin
  if not public.is_moderator_or_above() then
    raise exception 'Moderator permission required';
  end if;

  if not exists (select 1 from public.moderation_assert_target_profile(p_target_user_id)) then
    raise exception 'Target user not found';
  end if;

  update public.profiles
  set is_muted = false,
      updated_at = now()
  where id = p_target_user_id;

  insert into public.moderation_actions (
    target_user_id,
    actor_user_id,
    action_type,
    reason
  )
  values (
    p_target_user_id,
    auth.uid(),
    'unmute',
    nullif(trim(coalesce(p_reason, '')), '')
  )
  returning id into v_action_id;

  return v_action_id;
end;
$$;

create or replace function public.moderation_ban_user(
  p_target_user_id uuid,
  p_reason text,
  p_expires_at timestamptz default null,
  p_related_post_id uuid default null,
  p_related_report_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target record;
  v_action_id uuid;
begin
  if not public.is_admin_or_above() then
    raise exception 'Admin permission required';
  end if;

  select * into v_target
  from public.moderation_assert_target_profile(p_target_user_id)
  limit 1;

  if v_target.id is null then
    raise exception 'Target user not found';
  end if;

  if p_target_user_id = auth.uid() or v_target.role = 'ceo' then
    raise exception 'You cannot ban this user';
  end if;

  update public.profiles
  set is_banned = true,
      updated_at = now()
  where id = p_target_user_id;

  insert into public.moderation_actions (
    target_user_id,
    actor_user_id,
    related_post_id,
    related_report_id,
    action_type,
    reason,
    expires_at
  )
  values (
    p_target_user_id,
    auth.uid(),
    p_related_post_id,
    p_related_report_id,
    'ban',
    nullif(trim(coalesce(p_reason, '')), ''),
    p_expires_at
  )
  returning id into v_action_id;

  return v_action_id;
end;
$$;

create or replace function public.moderation_unban_user(
  p_target_user_id uuid,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action_id uuid;
begin
  if not public.is_admin_or_above() then
    raise exception 'Admin permission required';
  end if;

  if not exists (select 1 from public.moderation_assert_target_profile(p_target_user_id)) then
    raise exception 'Target user not found';
  end if;

  update public.profiles
  set is_banned = false,
      updated_at = now()
  where id = p_target_user_id;

  insert into public.moderation_actions (
    target_user_id,
    actor_user_id,
    action_type,
    reason
  )
  values (
    p_target_user_id,
    auth.uid(),
    'unban',
    nullif(trim(coalesce(p_reason, '')), '')
  )
  returning id into v_action_id;

  return v_action_id;
end;
$$;

create or replace function public.moderation_remove_post(
  p_post_id uuid,
  p_reason text,
  p_related_report_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post record;
  v_action_id uuid;
begin
  if not public.is_moderator_or_above() then
    raise exception 'Moderator permission required';
  end if;

  select p.id, p.user_id, p.is_deleted
  into v_post
  from public.posts p
  where p.id = p_post_id;

  if v_post.id is null then
    raise exception 'Post not found';
  end if;

  if coalesce(v_post.is_deleted, false) = false then
    update public.posts
    set is_deleted = true,
        deleted_at = now(),
        updated_at = now()
    where id = p_post_id;
  end if;

  if p_related_report_id is not null then
    update public.post_reports
    set status = 'actioned',
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        updated_at = now()
    where id = p_related_report_id;
  end if;

  insert into public.moderation_actions (
    target_user_id,
    actor_user_id,
    related_post_id,
    related_report_id,
    action_type,
    reason
  )
  values (
    v_post.user_id,
    auth.uid(),
    p_post_id,
    p_related_report_id,
    'remove_post',
    nullif(trim(coalesce(p_reason, '')), '')
  )
  returning id into v_action_id;

  return v_action_id;
end;
$$;

create or replace function public.moderation_update_report_status(
  p_report_id uuid,
  p_status text,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report record;
  v_action_type text;
  v_action_id uuid;
begin
  if not public.is_moderator_or_above() then
    raise exception 'Moderator permission required';
  end if;

  if p_status not in ('reviewed', 'dismissed') then
    raise exception 'Invalid moderation report status';
  end if;

  select pr.id, pr.post_id, pr.status, p.user_id as target_user_id
  into v_report
  from public.post_reports pr
  left join public.posts p
    on p.id = pr.post_id
  where pr.id = p_report_id;

  if v_report.id is null then
    raise exception 'Report not found';
  end if;

  update public.post_reports
  set status = p_status,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where id = p_report_id;

  v_action_type := case
    when p_status = 'dismissed' then 'dismiss_report'
    else 'review_report'
  end;

  insert into public.moderation_actions (
    target_user_id,
    actor_user_id,
    related_post_id,
    related_report_id,
    action_type,
    reason
  )
  values (
    v_report.target_user_id,
    auth.uid(),
    v_report.post_id,
    p_report_id,
    v_action_type,
    nullif(trim(coalesce(p_reason, '')), '')
  )
  returning id into v_action_id;

  return v_action_id;
end;
$$;

create or replace function public.moderation_add_admin_note(
  p_target_user_id uuid,
  p_note text,
  p_related_post_id uuid default null,
  p_related_report_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action_id uuid;
begin
  if not public.is_moderator_or_above() then
    raise exception 'Moderator permission required';
  end if;

  if nullif(trim(coalesce(p_note, '')), '') is null then
    raise exception 'Admin note is required';
  end if;

  if not exists (select 1 from public.moderation_assert_target_profile(p_target_user_id)) then
    raise exception 'Target user not found';
  end if;

  insert into public.moderation_actions (
    target_user_id,
    actor_user_id,
    related_post_id,
    related_report_id,
    action_type,
    message
  )
  values (
    p_target_user_id,
    auth.uid(),
    p_related_post_id,
    p_related_report_id,
    'admin_note',
    nullif(trim(coalesce(p_note, '')), '')
  )
  returning id into v_action_id;

  return v_action_id;
end;
$$;

create or replace function public.moderation_update_user_role(
  p_target_user_id uuid,
  p_new_role text,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target record;
  v_action_type text;
  v_current_rank integer;
  v_new_rank integer;
  v_action_id uuid;
begin
  if not public.is_ceo() then
    raise exception 'CEO permission required';
  end if;

  if p_new_role not in ('user', 'moderator', 'admin') then
    raise exception 'Invalid target role';
  end if;

  if p_target_user_id = auth.uid() then
    raise exception 'You cannot change your own role';
  end if;

  select * into v_target
  from public.moderation_assert_target_profile(p_target_user_id)
  limit 1;

  if v_target.id is null then
    raise exception 'Target user not found';
  end if;

  if v_target.role = 'ceo' then
    raise exception 'CEO accounts cannot be changed by this action';
  end if;

  v_current_rank := case v_target.role
    when 'admin' then 3
    when 'moderator' then 2
    else 1
  end;

  v_new_rank := case p_new_role
    when 'admin' then 3
    when 'moderator' then 2
    else 1
  end;

  v_action_type := case
    when v_new_rank > v_current_rank then 'promote_user'
    else 'demote_user'
  end;

  update public.profiles
  set role = p_new_role,
      updated_at = now()
  where id = p_target_user_id;

  insert into public.moderation_actions (
    target_user_id,
    actor_user_id,
    action_type,
    reason,
    message
  )
  values (
    p_target_user_id,
    auth.uid(),
    v_action_type,
    nullif(trim(coalesce(p_reason, '')), ''),
    'Role changed from ' || coalesce(v_target.role, 'user') || ' to ' || p_new_role
  )
  returning id into v_action_id;

  return v_action_id;
end;
$$;

revoke all on function public.moderation_warn_user(uuid, text, text, uuid, uuid) from public;
revoke all on function public.moderation_mute_user(uuid, text, timestamptz, uuid, uuid) from public;
revoke all on function public.moderation_unmute_user(uuid, text) from public;
revoke all on function public.moderation_ban_user(uuid, text, timestamptz, uuid, uuid) from public;
revoke all on function public.moderation_unban_user(uuid, text) from public;
revoke all on function public.moderation_remove_post(uuid, text, uuid) from public;
revoke all on function public.moderation_update_report_status(uuid, text, text) from public;
revoke all on function public.moderation_add_admin_note(uuid, text, uuid, uuid) from public;
revoke all on function public.moderation_update_user_role(uuid, text, text) from public;

grant execute on function public.moderation_warn_user(uuid, text, text, uuid, uuid) to authenticated;
grant execute on function public.moderation_mute_user(uuid, text, timestamptz, uuid, uuid) to authenticated;
grant execute on function public.moderation_unmute_user(uuid, text) to authenticated;
grant execute on function public.moderation_ban_user(uuid, text, timestamptz, uuid, uuid) to authenticated;
grant execute on function public.moderation_unban_user(uuid, text) to authenticated;
grant execute on function public.moderation_remove_post(uuid, text, uuid) to authenticated;
grant execute on function public.moderation_update_report_status(uuid, text, text) to authenticated;
grant execute on function public.moderation_add_admin_note(uuid, text, uuid, uuid) to authenticated;
grant execute on function public.moderation_update_user_role(uuid, text, text) to authenticated;

drop function if exists public.get_my_profile_auth_status();

create or replace function public.get_my_profile_auth_status()
returns table (
  id uuid,
  username text,
  role text,
  dob date,
  age_verified_at timestamptz,
  is_banned boolean,
  is_muted boolean,
  is_deleted boolean
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    p.username,
    p.role,
    p.dob,
    p.age_verified_at,
    coalesce(p.is_banned, false) as is_banned,
    coalesce(p.is_muted, false) as is_muted,
    coalesce(p.is_deleted, false) as is_deleted
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

revoke all on function public.get_my_profile_auth_status() from public;
grant execute on function public.get_my_profile_auth_status() to authenticated;

create or replace function public.toggle_post_vote(
  target_post_id uuid,
  target_vote_type text
)
returns table (
  post_id uuid,
  user_vote text,
  score integer,
  vote_score integer,
  vote_count integer,
  upvote_count integer,
  downvote_count integer,
  interaction_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_vote_type text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        coalesce(p.is_banned, false) = true
        or coalesce(p.is_muted, false) = true
        or coalesce(p.is_deleted, false) = true
      )
  ) then
    raise exception 'Your account cannot vote right now';
  end if;

  if target_vote_type not in ('upvote', 'downvote') then
    raise exception 'Vote type must be upvote or downvote';
  end if;

  if not exists (
    select 1
    from public.posts p
    where p.id = target_post_id
      and p.is_deleted = false
      and p.visibility = 'public'
  ) then
    raise exception 'Post not found or not votable';
  end if;

  select pv.vote_type
  into existing_vote_type
  from public.post_votes pv
  where pv.post_id = target_post_id
    and pv.user_id = auth.uid();

  if existing_vote_type = target_vote_type then
    delete from public.post_votes pv
    where pv.post_id = target_post_id
      and pv.user_id = auth.uid();

  elsif existing_vote_type is null then
    insert into public.post_votes (post_id, user_id, vote_type)
    values (target_post_id, auth.uid(), target_vote_type);

  else
    update public.post_votes pv
    set vote_type = target_vote_type
    where pv.post_id = target_post_id
      and pv.user_id = auth.uid();
  end if;

  return query
  select
    pvc.post_id,
    (
      select pv.vote_type
      from public.post_votes pv
      where pv.post_id = target_post_id
        and pv.user_id = auth.uid()
    ) as user_vote,
    pvc.score,
    pvc.vote_score,
    pvc.vote_count,
    pvc.upvote_count,
    pvc.downvote_count,
    pvc.interaction_count
  from public.post_vote_counts pvc
  where pvc.post_id = target_post_id;
end;
$$;

revoke all on function public.toggle_post_vote(uuid, text) from public;
grant execute on function public.toggle_post_vote(uuid, text) to authenticated;

commit;
