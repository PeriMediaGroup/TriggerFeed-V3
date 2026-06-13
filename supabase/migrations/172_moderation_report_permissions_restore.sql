-- =========================================================
-- 172: Moderation Report Permissions and Restore Support
-- =========================================================

begin;

alter table public.posts
  add column if not exists removed_at timestamptz,
  add column if not exists removed_by uuid references public.profiles(id) on delete set null,
  add column if not exists removal_reason text,
  add column if not exists restored_at timestamptz,
  add column if not exists restored_by uuid references public.profiles(id) on delete set null;

create index if not exists posts_removed_by_idx
  on public.posts(removed_by);

create index if not exists posts_restored_by_idx
  on public.posts(restored_by);

create or replace function public.get_current_moderation_actor_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
    and coalesce(p.is_banned, false) = false
    and coalesce(p.is_deleted, false) = false
  limit 1;
$$;

revoke all on function public.get_current_moderation_actor_role() from public;
grant execute on function public.get_current_moderation_actor_role() to authenticated;

create or replace function public.get_post_reports_for_moderation()
returns table (
  id uuid,
  post_id uuid,
  reporter_id uuid,
  reason text,
  details text,
  status text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  post jsonb,
  reporter jsonb,
  reviewer jsonb,
  post_author jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_moderator_or_above() then
    raise exception 'Moderator permission required';
  end if;

  return query
  select
    pr.id,
    pr.post_id,
    pr.reporter_id,
    pr.reason,
    pr.details,
    pr.status,
    pr.reviewed_by,
    pr.reviewed_at,
    pr.created_at,
    pr.updated_at,
    case
      when p.id is null then null
      else jsonb_build_object(
        'id', p.id,
        'title', p.title,
        'body', p.body,
        'user_id', p.user_id,
        'visibility', p.visibility,
        'is_deleted', p.is_deleted,
        'deleted_at', p.deleted_at,
        'removed_at', p.removed_at,
        'removed_by', p.removed_by,
        'removal_reason', p.removal_reason,
        'restored_at', p.restored_at,
        'restored_by', p.restored_by,
        'created_at', p.created_at
      )
    end as post,
    case
      when reporter.id is null then null
      else jsonb_build_object(
        'id', reporter.id,
        'username', reporter.username,
        'display_name', reporter.display_name,
        'first_name', reporter.first_name,
        'last_name', reporter.last_name,
        'avatar_cloudinary_url', reporter.avatar_cloudinary_url,
        'profile_badge', reporter.profile_badge,
        'role', reporter.role,
        'is_banned', coalesce(reporter.is_banned, false),
        'is_muted', coalesce(reporter.is_muted, false),
        'is_deleted', coalesce(reporter.is_deleted, false)
      )
    end as reporter,
    case
      when reviewer.id is null then null
      else jsonb_build_object(
        'id', reviewer.id,
        'username', reviewer.username,
        'display_name', reviewer.display_name,
        'first_name', reviewer.first_name,
        'last_name', reviewer.last_name,
        'avatar_cloudinary_url', reviewer.avatar_cloudinary_url,
        'profile_badge', reviewer.profile_badge,
        'role', reviewer.role,
        'is_banned', coalesce(reviewer.is_banned, false),
        'is_muted', coalesce(reviewer.is_muted, false),
        'is_deleted', coalesce(reviewer.is_deleted, false)
      )
    end as reviewer,
    case
      when author.id is null then null
      else jsonb_build_object(
        'id', author.id,
        'username', author.username,
        'display_name', author.display_name,
        'first_name', author.first_name,
        'last_name', author.last_name,
        'avatar_cloudinary_url', author.avatar_cloudinary_url,
        'profile_badge', author.profile_badge,
        'role', author.role,
        'is_banned', coalesce(author.is_banned, false),
        'is_muted', coalesce(author.is_muted, false),
        'is_deleted', coalesce(author.is_deleted, false)
      )
    end as post_author
  from public.post_reports pr
  left join public.posts p
    on p.id = pr.post_id
  left join public.profiles reporter
    on reporter.id = pr.reporter_id
  left join public.profiles reviewer
    on reviewer.id = pr.reviewed_by
  left join public.profiles author
    on author.id = p.user_id
  order by pr.created_at desc;
end;
$$;

revoke all on function public.get_post_reports_for_moderation() from public;
grant execute on function public.get_post_reports_for_moderation() to authenticated;

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
      action_type in ('dismiss_report', 'review_report', 'admin_note')
      and public.is_moderator_or_above()
    )
    or (
      action_type in ('warn', 'mute', 'unmute', 'ban', 'unban')
      and (
        (
          public.get_current_moderation_actor_role() = 'ceo'
          and target_user_id <> auth.uid()
          and exists (
            select 1
            from public.profiles target_profile
            where target_profile.id = target_user_id
              and target_profile.role <> 'ceo'
              and coalesce(target_profile.is_deleted, false) = false
          )
        )
        or (
          public.get_current_moderation_actor_role() = 'admin'
          and target_user_id <> auth.uid()
          and exists (
            select 1
            from public.profiles target_profile
            where target_profile.id = target_user_id
              and target_profile.role in ('user', 'moderator')
              and coalesce(target_profile.is_deleted, false) = false
          )
        )
      )
    )
    or (
      action_type = 'remove_post'
      and (
        public.get_current_moderation_actor_role() = 'ceo'
        or (
          public.get_current_moderation_actor_role() = 'admin'
          and exists (
            select 1
            from public.profiles target_profile
            where target_profile.id = target_user_id
              and target_profile.role in ('user', 'moderator')
              and coalesce(target_profile.is_deleted, false) = false
          )
        )
      )
    )
    or (
      action_type = 'restore_post'
      and public.get_current_moderation_actor_role() = 'ceo'
    )
    or (
      action_type in ('promote_user', 'demote_user')
      and public.is_ceo()
    )
  )
);

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
  v_event_id uuid;
  v_actor_role text := public.get_current_moderation_actor_role();
  v_target record;
  v_warning_message text := nullif(trim(coalesce(p_message, '')), '');
  v_warning_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_related_post_id uuid := p_related_post_id;
  v_post_title text;
  v_post_body text;
  v_post_excerpt text;
  v_post_available boolean := false;
  v_report_reason text;
begin
  select * into v_target
  from public.moderation_assert_target_profile(p_target_user_id)
  limit 1;

  if v_target.id is null then
    raise exception 'Target user not found';
  end if;

  if v_actor_role = 'ceo' then
    if p_target_user_id = auth.uid() or v_target.role = 'ceo' then
      raise exception 'You cannot warn this user';
    end if;
  elsif v_actor_role = 'admin' then
    if p_target_user_id = auth.uid() or v_target.role not in ('user', 'moderator') then
      raise exception 'You cannot warn this user';
    end if;
  else
    raise exception 'Admin permission required';
  end if;

  if p_related_report_id is not null then
    select pr.post_id, nullif(trim(coalesce(pr.reason, '')), '')
    into v_related_post_id, v_report_reason
    from public.post_reports pr
    where pr.id = p_related_report_id
      and (v_related_post_id is null or pr.post_id = v_related_post_id);
  end if;

  if v_related_post_id is not null then
    select
      nullif(trim(coalesce(p.title, '')), ''),
      nullif(trim(coalesce(p.body, '')), ''),
      coalesce(p.is_deleted, false) = false and p.visibility = 'public'
    into v_post_title, v_post_body, v_post_available
    from public.posts p
    where p.id = v_related_post_id
      and p.user_id = p_target_user_id;
  end if;

  v_post_excerpt := nullif(trim(coalesce(v_post_body, '')), '');

  if v_post_excerpt is not null and char_length(v_post_excerpt) > 160 then
    v_post_excerpt := trim(left(v_post_excerpt, 160)) || '...';
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
    v_related_post_id,
    p_related_report_id,
    'warn',
    v_warning_reason,
    v_warning_message
  )
  returning id into v_action_id;

  insert into public.moderation_events (
    user_id,
    moderator_id,
    action,
    reason,
    expires_at
  )
  values (
    p_target_user_id,
    auth.uid(),
    'warned',
    coalesce(v_warning_message, v_warning_reason),
    null
  )
  returning id into v_event_id;

  insert into public.notifications (
    user_id,
    actor_id,
    type,
    title,
    body,
    metadata
  )
  values (
    p_target_user_id,
    null,
    'moderation_warning',
    'Moderation warning',
    'You received a warning from TriggerFeed moderation.',
    jsonb_strip_nulls(jsonb_build_object(
      'action', 'warned',
      'message', v_warning_message,
      'reason', v_warning_reason,
      'post_id', v_related_post_id,
      'post_title', v_post_title,
      'post_excerpt', v_post_excerpt,
      'post_available', v_post_available,
      'report_reason', coalesce(v_report_reason, v_warning_reason),
      'report_id', p_related_report_id,
      'moderation_action_id', v_action_id,
      'moderation_event_id', v_event_id
    ))
  );

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
  v_actor_role text := public.get_current_moderation_actor_role();
  v_target record;
  v_action_id uuid;
begin
  select * into v_target
  from public.moderation_assert_target_profile(p_target_user_id)
  limit 1;

  if v_target.id is null then
    raise exception 'Target user not found';
  end if;

  if v_actor_role = 'ceo' then
    if p_target_user_id = auth.uid() or v_target.role = 'ceo' then
      raise exception 'You cannot ban this user';
    end if;
  elsif v_actor_role = 'admin' then
    if p_target_user_id = auth.uid() or v_target.role not in ('user', 'moderator') then
      raise exception 'You cannot ban this user';
    end if;
  else
    raise exception 'Admin permission required';
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
  v_actor_role text := public.get_current_moderation_actor_role();
  v_target record;
  v_action_id uuid;
begin
  select * into v_target
  from public.moderation_assert_target_profile(p_target_user_id)
  limit 1;

  if v_target.id is null then
    raise exception 'Target user not found';
  end if;

  if v_actor_role = 'ceo' then
    if p_target_user_id = auth.uid() or v_target.role = 'ceo' then
      raise exception 'You cannot mute this user';
    end if;
  elsif v_actor_role = 'admin' then
    if p_target_user_id = auth.uid() or v_target.role not in ('user', 'moderator') then
      raise exception 'You cannot mute this user';
    end if;
  else
    raise exception 'Admin permission required';
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
  v_actor_role text := public.get_current_moderation_actor_role();
  v_target record;
  v_action_id uuid;
begin
  select * into v_target
  from public.moderation_assert_target_profile(p_target_user_id)
  limit 1;

  if v_target.id is null then
    raise exception 'Target user not found';
  end if;

  if v_actor_role = 'ceo' then
    if p_target_user_id = auth.uid() or v_target.role = 'ceo' then
      raise exception 'You cannot unban this user';
    end if;
  elsif v_actor_role = 'admin' then
    if p_target_user_id = auth.uid() or v_target.role not in ('user', 'moderator') then
      raise exception 'You cannot unban this user';
    end if;
  else
    raise exception 'Admin permission required';
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
  v_actor_role text := public.get_current_moderation_actor_role();
  v_target record;
  v_action_id uuid;
begin
  select * into v_target
  from public.moderation_assert_target_profile(p_target_user_id)
  limit 1;

  if v_target.id is null then
    raise exception 'Target user not found';
  end if;

  if v_actor_role = 'ceo' then
    if p_target_user_id = auth.uid() or v_target.role = 'ceo' then
      raise exception 'You cannot unmute this user';
    end if;
  elsif v_actor_role = 'admin' then
    if p_target_user_id = auth.uid() or v_target.role not in ('user', 'moderator') then
      raise exception 'You cannot unmute this user';
    end if;
  else
    raise exception 'Admin permission required';
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
  v_actor_role text := public.get_current_moderation_actor_role();
  v_post record;
  v_action_id uuid;
begin
  select
    p.id,
    p.user_id,
    p.is_deleted,
    author.role as author_role
  into v_post
  from public.posts p
  left join public.profiles author
    on author.id = p.user_id
  where p.id = p_post_id;

  if v_post.id is null then
    raise exception 'Post not found';
  end if;

  if v_actor_role = 'ceo' then
    null;
  elsif v_actor_role = 'admin' then
    if v_post.author_role is null or v_post.author_role not in ('user', 'moderator') then
      raise exception 'You cannot remove this post';
    end if;
  else
    raise exception 'Admin permission required';
  end if;

  if coalesce(v_post.is_deleted, false) = false then
    update public.posts
    set is_deleted = true,
        deleted_at = now(),
        removed_at = now(),
        removed_by = auth.uid(),
        removal_reason = nullif(trim(coalesce(p_reason, '')), ''),
        restored_at = null,
        restored_by = null,
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

create or replace function public.moderation_restore_post(
  p_post_id uuid,
  p_reason text default null,
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
  if public.get_current_moderation_actor_role() <> 'ceo' then
    raise exception 'CEO permission required';
  end if;

  select p.id, p.user_id, p.is_deleted
  into v_post
  from public.posts p
  where p.id = p_post_id;

  if v_post.id is null then
    raise exception 'Post not found';
  end if;

  if coalesce(v_post.is_deleted, false) = true then
    update public.posts
    set is_deleted = false,
        deleted_at = null,
        restored_at = now(),
        restored_by = auth.uid(),
        updated_at = now()
    where id = p_post_id;
  end if;

  if p_related_report_id is not null then
    update public.post_reports
    set status = 'reviewed',
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
    'restore_post',
    nullif(trim(coalesce(p_reason, '')), '')
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
revoke all on function public.moderation_restore_post(uuid, text, uuid) from public;

grant execute on function public.moderation_warn_user(uuid, text, text, uuid, uuid) to authenticated;
grant execute on function public.moderation_mute_user(uuid, text, timestamptz, uuid, uuid) to authenticated;
grant execute on function public.moderation_unmute_user(uuid, text) to authenticated;
grant execute on function public.moderation_ban_user(uuid, text, timestamptz, uuid, uuid) to authenticated;
grant execute on function public.moderation_unban_user(uuid, text) to authenticated;
grant execute on function public.moderation_remove_post(uuid, text, uuid) to authenticated;
grant execute on function public.moderation_restore_post(uuid, text, uuid) to authenticated;

commit;
