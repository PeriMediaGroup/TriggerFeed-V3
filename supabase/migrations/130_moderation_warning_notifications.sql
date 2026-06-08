-- =========================================================
-- 130: Moderation Warning Notifications
-- =========================================================

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
      'system'
    )
  );

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
    else true
  end;
$$;

revoke all on function public.should_create_notification(uuid, text) from public;

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

  if public.should_create_notification(p_target_user_id, 'moderation_warning') then
    insert into public.notifications (
      user_id,
      actor_id,
      type,
      post_id,
      title,
      body,
      metadata
    )
    values (
      p_target_user_id,
      null,
      'moderation_warning',
      p_related_post_id,
      'Moderation warning',
      'You received a warning from TriggerFeed moderation.',
      jsonb_strip_nulls(jsonb_build_object(
        'moderation_action_id', v_action_id,
        'related_post_id', p_related_post_id,
        'related_report_id', p_related_report_id,
        'message', nullif(trim(coalesce(p_message, '')), '')
      ))
    );
  end if;

  return v_action_id;
end;
$$;

revoke all on function public.moderation_warn_user(uuid, text, text, uuid, uuid) from public;
grant execute on function public.moderation_warn_user(uuid, text, text, uuid, uuid) to authenticated;

commit;
