-- =========================================================
-- 182: Tiered Moderation and CEO Role Changes
-- =========================================================

begin;

alter table public.post_reports
  drop constraint if exists post_reports_status_check;

alter table public.post_reports
  add constraint post_reports_status_check
  check (
    status in (
      -- Current legacy statuses.
      'open',
      'reviewed',
      'dismissed',
      'actioned',
      -- Beta tiered moderation statuses.
      'pending',
      'under_review',
      'warned',
      'post_removed',
      'escalated',
      'muted',
      'ban_recommended',
      'banned'
    )
  );

alter table public.abuse_reports
  drop constraint if exists abuse_reports_status_check;

alter table public.abuse_reports
  add constraint abuse_reports_status_check
  check (
    status in (
      -- Current legacy statuses.
      'new',
      'reviewing',
      'reviewed',
      'dismissed',
      'action_taken',
      -- Beta admin-count statuses.
      'pending',
      'under_review'
    )
  );

alter table public.moderation_actions
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.moderation_actions
  drop constraint if exists moderation_actions_action_type_check;

alter table public.moderation_actions
  add constraint moderation_actions_action_type_check
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
      'escalate_report',
      'recommend_ban',
      'admin_note',
      'promote_user',
      'demote_user',
      'role_changed'
    )
  );

create or replace function public.get_admin_nav_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor_role text := public.get_current_moderation_actor_role();
  v_reports integer := 0;
  v_abuse_reports integer := 0;
  v_reviews integer := 0;
  v_role_reviews integer := 0;
  v_total integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if v_actor_role not in ('moderator', 'admin', 'ceo') then
    raise exception 'Moderator permission required';
  end if;

  select count(*)::integer
  into v_reports
  from public.post_reports pr
  where pr.status in (
    'pending',
    'under_review',
    'escalated',
    'ban_recommended',
    -- Current legacy report status used by the existing moderation UI.
    'open'
  );

  if v_actor_role in ('admin', 'ceo')
    and to_regclass('public.abuse_reports') is not null then
    select count(*)::integer
    into v_abuse_reports
    from public.abuse_reports ar
    where ar.status in (
      'pending',
      'under_review',
      -- Current legacy abuse report statuses used by the existing abuse UI.
      'new',
      'reviewing'
    );
  end if;

  if v_actor_role in ('admin', 'ceo')
    and to_regclass('public.moderation_reviews') is not null then
    execute
      'select count(*)::integer
       from public.moderation_reviews mr
       where mr.status in (''pending'', ''under_review'', ''escalated'')'
    into v_reviews;
  end if;

  -- Future role-review workflow count. Keep zero until a real table/route exists.
  v_role_reviews := 0;

  v_total := v_reports + v_abuse_reports + v_reviews + v_role_reviews;

  return jsonb_build_object(
    'reports', v_reports,
    'abuseReports', v_abuse_reports,
    'reviews', v_reviews,
    'roleReviews', v_role_reviews,
    'total', v_total
  );
end;
$$;

create or replace function public.change_user_role(
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
  v_new_role text := lower(trim(coalesce(p_new_role, '')));
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_action_id uuid;
begin
  if not public.is_ceo() then
    raise exception 'CEO permission required';
  end if;

  if v_new_role not in ('user', 'moderator', 'admin') then
    raise exception 'Invalid target role';
  end if;

  if v_reason is null then
    raise exception 'Role change reason is required';
  end if;

  if p_target_user_id = auth.uid() then
    raise exception 'You cannot change your own role';
  end if;

  select p.id, p.role
  into v_target
  from public.profiles p
  where p.id = p_target_user_id
    and coalesce(p.is_deleted, false) = false
  limit 1;

  if v_target.id is null then
    raise exception 'Target user not found';
  end if;

  if v_target.role = 'ceo' then
    raise exception 'CEO accounts cannot be changed by this action';
  end if;

  if v_target.role = v_new_role then
    raise exception 'Target user already has that role';
  end if;

  update public.profiles
  set role = v_new_role,
      updated_at = now()
  where id = p_target_user_id;

  insert into public.moderation_actions (
    target_user_id,
    actor_user_id,
    action_type,
    reason,
    message,
    metadata
  )
  values (
    p_target_user_id,
    auth.uid(),
    'role_changed',
    v_reason,
    'Role changed from ' || coalesce(v_target.role, 'user') || ' to ' || v_new_role,
    jsonb_build_object(
      'old_role', coalesce(v_target.role, 'user'),
      'new_role', v_new_role
    )
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
language sql
security definer
set search_path = public
as $$
  select public.change_user_role(p_target_user_id, p_new_role, p_reason);
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
  v_actor_role text := public.get_current_moderation_actor_role();
  v_status text := lower(trim(coalesce(p_status, '')));
  v_report record;
  v_action_type text;
  v_action_id uuid;
begin
  if v_actor_role not in ('moderator', 'admin', 'ceo') then
    raise exception 'Moderator permission required';
  end if;

  if v_status not in (
    'under_review',
    'reviewed',
    'dismissed',
    'escalated',
    'ban_recommended'
  ) then
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

  if v_status = 'ban_recommended' and v_actor_role not in ('moderator', 'admin', 'ceo') then
    raise exception 'Moderator permission required';
  end if;

  update public.post_reports
  set status = v_status,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where id = p_report_id;

  v_action_type := case
    when v_status = 'dismissed' then 'dismiss_report'
    when v_status = 'escalated' then 'escalate_report'
    when v_status = 'ban_recommended' then 'recommend_ban'
    else 'review_report'
  end;

  insert into public.moderation_actions (
    target_user_id,
    actor_user_id,
    related_post_id,
    related_report_id,
    action_type,
    reason,
    metadata
  )
  values (
    v_report.target_user_id,
    auth.uid(),
    v_report.post_id,
    p_report_id,
    v_action_type,
    nullif(trim(coalesce(p_reason, '')), ''),
    jsonb_build_object('status', v_status)
  )
  returning id into v_action_id;

  return v_action_id;
end;
$$;

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
  v_actor_role text := public.get_current_moderation_actor_role();
  v_action_id uuid;
  v_event_id uuid;
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
  if v_actor_role not in ('moderator', 'admin', 'ceo') then
    raise exception 'Moderator permission required';
  end if;

  select * into v_target
  from public.moderation_assert_target_profile(p_target_user_id)
  limit 1;

  if v_target.id is null then
    raise exception 'Target user not found';
  end if;

  if p_target_user_id = auth.uid()
    or v_target.role in ('admin', 'ceo') then
    raise exception 'You cannot warn this user';
  end if;

  if v_actor_role = 'moderator'
    and v_target.role <> 'user' then
    raise exception 'You cannot warn this user';
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

  if p_related_report_id is not null then
    update public.post_reports
    set status = 'warned',
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        updated_at = now()
    where id = p_related_report_id;
  end if;

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
  -- TODO: add duration-specific mute tiers when the schema supports them.
  if v_actor_role not in ('admin', 'ceo') then
    raise exception 'Admin permission required';
  end if;

  select * into v_target
  from public.moderation_assert_target_profile(p_target_user_id)
  limit 1;

  if v_target.id is null then
    raise exception 'Target user not found';
  end if;

  if p_target_user_id = auth.uid()
    or v_target.role = 'ceo'
    or (v_actor_role = 'admin' and v_target.role not in ('user', 'moderator')) then
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

  if p_related_report_id is not null then
    update public.post_reports
    set status = 'muted',
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        updated_at = now()
    where id = p_related_report_id;
  end if;

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
  if v_actor_role not in ('admin', 'ceo') then
    raise exception 'Admin permission required';
  end if;

  select * into v_target
  from public.moderation_assert_target_profile(p_target_user_id)
  limit 1;

  if v_target.id is null then
    raise exception 'Target user not found';
  end if;

  if p_target_user_id = auth.uid()
    or v_target.role = 'ceo'
    or (v_actor_role = 'admin' and v_target.role not in ('user', 'moderator')) then
    raise exception 'You cannot unmute this user';
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
  if public.get_current_moderation_actor_role() <> 'ceo' then
    raise exception 'CEO permission required';
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

  if p_related_report_id is not null then
    update public.post_reports
    set status = 'banned',
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        updated_at = now()
    where id = p_related_report_id;
  end if;

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
  v_target record;
  v_action_id uuid;
begin
  if public.get_current_moderation_actor_role() <> 'ceo' then
    raise exception 'CEO permission required';
  end if;

  select * into v_target
  from public.moderation_assert_target_profile(p_target_user_id)
  limit 1;

  if v_target.id is null then
    raise exception 'Target user not found';
  end if;

  if p_target_user_id = auth.uid() or v_target.role = 'ceo' then
    raise exception 'You cannot unban this user';
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
  v_actor_role text := public.get_current_moderation_actor_role();
  v_post record;
  v_action_id uuid;
begin
  if v_actor_role not in ('moderator', 'admin', 'ceo') then
    raise exception 'Moderator permission required';
  end if;

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

  if v_actor_role = 'moderator' then
    if v_post.author_role <> 'user' then
      raise exception 'You cannot remove this post';
    end if;
  elsif v_actor_role = 'admin' then
    if v_post.author_role is null or v_post.author_role not in ('user', 'moderator') then
      raise exception 'You cannot remove this post';
    end if;
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
    set status = 'post_removed',
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

revoke all on function public.get_admin_nav_counts() from public;
revoke all on function public.change_user_role(uuid, text, text) from public;
revoke all on function public.moderation_update_user_role(uuid, text, text) from public;
revoke all on function public.moderation_update_report_status(uuid, text, text) from public;
revoke all on function public.moderation_warn_user(uuid, text, text, uuid, uuid) from public;
revoke all on function public.moderation_mute_user(uuid, text, timestamptz, uuid, uuid) from public;
revoke all on function public.moderation_unmute_user(uuid, text) from public;
revoke all on function public.moderation_ban_user(uuid, text, timestamptz, uuid, uuid) from public;
revoke all on function public.moderation_unban_user(uuid, text) from public;
revoke all on function public.moderation_remove_post(uuid, text, uuid) from public;

grant execute on function public.get_admin_nav_counts() to authenticated;
grant execute on function public.change_user_role(uuid, text, text) to authenticated;
grant execute on function public.moderation_update_user_role(uuid, text, text) to authenticated;
grant execute on function public.moderation_update_report_status(uuid, text, text) to authenticated;
grant execute on function public.moderation_warn_user(uuid, text, text, uuid, uuid) to authenticated;
grant execute on function public.moderation_mute_user(uuid, text, timestamptz, uuid, uuid) to authenticated;
grant execute on function public.moderation_unmute_user(uuid, text) to authenticated;
grant execute on function public.moderation_ban_user(uuid, text, timestamptz, uuid, uuid) to authenticated;
grant execute on function public.moderation_unban_user(uuid, text) to authenticated;
grant execute on function public.moderation_remove_post(uuid, text, uuid) to authenticated;

commit;
