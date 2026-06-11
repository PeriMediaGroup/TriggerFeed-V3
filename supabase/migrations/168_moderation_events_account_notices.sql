begin;

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (
    type in (
      'mention',
      'comment',
      'reply',
      'friend_request',
      'friend_accepted',
      'moderation_warning',
      'account_muted',
      'account_banned',
      'account_unmuted',
      'account_unbanned',
      'system'
    )
  );

create table if not exists public.moderation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  moderator_id uuid references public.profiles(id) on delete set null,
  action text not null,
  reason text,
  expires_at timestamptz,
  email_sent_at timestamptz,
  email_error text,
  created_at timestamptz not null default now(),

  constraint moderation_events_action_check
    check (action in ('muted', 'unmuted', 'banned', 'unbanned', 'warned'))
);

create index if not exists moderation_events_user_id_idx
  on public.moderation_events(user_id);

create index if not exists moderation_events_moderator_id_idx
  on public.moderation_events(moderator_id);

create index if not exists moderation_events_action_idx
  on public.moderation_events(action);

create index if not exists moderation_events_created_at_idx
  on public.moderation_events(created_at desc);

alter table public.moderation_events enable row level security;

revoke all on public.moderation_events from anon;
revoke all on public.moderation_events from authenticated;
grant select on public.moderation_events to authenticated;

drop policy if exists "moderation_events_select_moderators"
on public.moderation_events;

create policy "moderation_events_select_moderators"
on public.moderation_events
for select
to authenticated
using (public.is_moderator_or_above());

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
    when 'moderation_warning' then true
    when 'account_muted' then true
    when 'account_banned' then true
    when 'account_unmuted' then true
    when 'account_unbanned' then true
    else true
  end;
$$;

revoke all on function public.should_create_notification(uuid, text) from public;

create or replace function public.insert_account_moderation_notice(
  p_target_user_id uuid,
  p_moderator_id uuid,
  p_action text,
  p_reason text default null,
  p_expires_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_notification_type text;
  v_title text;
  v_body text;
begin
  insert into public.moderation_events (
    user_id,
    moderator_id,
    action,
    reason,
    expires_at
  )
  values (
    p_target_user_id,
    p_moderator_id,
    p_action,
    nullif(trim(coalesce(p_reason, '')), ''),
    p_expires_at
  )
  returning id into v_event_id;

  v_notification_type := case p_action
    when 'muted' then 'account_muted'
    when 'banned' then 'account_banned'
    when 'unmuted' then 'account_unmuted'
    when 'unbanned' then 'account_unbanned'
    when 'warned' then 'moderation_warning'
    else null
  end;

  v_title := case p_action
    when 'muted' then 'Account muted'
    when 'banned' then 'Account banned'
    when 'unmuted' then 'Account unmuted'
    when 'unbanned' then 'Account unbanned'
    when 'warned' then 'Moderation warning'
    else 'Account notice'
  end;

  v_body := case p_action
    when 'muted' then 'Your TriggerFeed account has been muted.'
    when 'banned' then 'Your TriggerFeed account has been banned.'
    when 'unmuted' then 'Your TriggerFeed account has been unmuted.'
    when 'unbanned' then 'Your TriggerFeed account has been unbanned.'
    when 'warned' then 'You received a warning from TriggerFeed moderation.'
    else 'You received an account notice from TriggerFeed moderation.'
  end;

  if v_notification_type is not null then
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
      v_notification_type,
      v_title,
      v_body,
      jsonb_strip_nulls(jsonb_build_object(
        'action', p_action,
        'reason', nullif(trim(coalesce(p_reason, '')), ''),
        'expires_at', p_expires_at,
        'moderation_event_id', v_event_id
      ))
    );
  end if;

  return v_event_id;
end;
$$;

revoke all on function public.insert_account_moderation_notice(uuid, uuid, text, text, timestamptz) from public;

create or replace function public.get_moderation_event_email_context(
  p_event_id uuid
)
returns table (
  moderation_event_id uuid,
  user_id uuid,
  email text,
  username text,
  display_name text,
  action text,
  reason text,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    me.id as moderation_event_id,
    p.id as user_id,
    p.email,
    p.username,
    p.display_name,
    me.action,
    me.reason,
    me.expires_at
  from public.moderation_events me
  join public.profiles p
    on p.id = me.user_id
  where me.id = p_event_id
    and me.moderator_id = auth.uid()
    and public.is_moderator_or_above()
  limit 1;
$$;

revoke all on function public.get_moderation_event_email_context(uuid) from public;
grant execute on function public.get_moderation_event_email_context(uuid) to authenticated;

create or replace function public.mark_moderation_event_email_result(
  p_event_id uuid,
  p_email_sent boolean,
  p_email_error text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  if not public.is_moderator_or_above() then
    raise exception 'Moderator permission required';
  end if;

  update public.moderation_events me
  set
    email_sent_at = case when p_email_sent then now() else null end,
    email_error = case
      when p_email_sent then null
      else nullif(trim(coalesce(p_email_error, '')), '')
    end
  where me.id = p_event_id
    and me.moderator_id = auth.uid()
  returning me.id into v_event_id;

  if v_event_id is null then
    raise exception 'Moderation event not found';
  end if;

  return v_event_id;
end;
$$;

revoke all on function public.mark_moderation_event_email_result(uuid, boolean, text) from public;
grant execute on function public.mark_moderation_event_email_result(uuid, boolean, text) to authenticated;

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

  perform public.insert_account_moderation_notice(
    p_target_user_id,
    auth.uid(),
    'warned',
    coalesce(nullif(trim(coalesce(p_message, '')), ''), nullif(trim(coalesce(p_reason, '')), '')),
    null
  );

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
  v_event_id uuid;
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

  v_event_id := public.insert_account_moderation_notice(
    p_target_user_id,
    auth.uid(),
    'muted',
    p_reason,
    p_expires_at
  );

  return v_event_id;
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
  v_event_id uuid;
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

  v_event_id := public.insert_account_moderation_notice(
    p_target_user_id,
    auth.uid(),
    'unmuted',
    p_reason,
    null
  );

  return v_event_id;
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
  v_event_id uuid;
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

  v_event_id := public.insert_account_moderation_notice(
    p_target_user_id,
    auth.uid(),
    'banned',
    p_reason,
    p_expires_at
  );

  return v_event_id;
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
  v_event_id uuid;
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

  v_event_id := public.insert_account_moderation_notice(
    p_target_user_id,
    auth.uid(),
    'unbanned',
    p_reason,
    null
  );

  return v_event_id;
end;
$$;

revoke all on function public.moderation_warn_user(uuid, text, text, uuid, uuid) from public;
revoke all on function public.moderation_mute_user(uuid, text, timestamptz, uuid, uuid) from public;
revoke all on function public.moderation_unmute_user(uuid, text) from public;
revoke all on function public.moderation_ban_user(uuid, text, timestamptz, uuid, uuid) from public;
revoke all on function public.moderation_unban_user(uuid, text) from public;

grant execute on function public.moderation_warn_user(uuid, text, text, uuid, uuid) to authenticated;
grant execute on function public.moderation_mute_user(uuid, text, timestamptz, uuid, uuid) to authenticated;
grant execute on function public.moderation_unmute_user(uuid, text) to authenticated;
grant execute on function public.moderation_ban_user(uuid, text, timestamptz, uuid, uuid) to authenticated;
grant execute on function public.moderation_unban_user(uuid, text) to authenticated;

commit;
