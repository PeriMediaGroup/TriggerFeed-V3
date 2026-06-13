-- =========================================================
-- 170: Keep moderation warning post links in metadata
-- =========================================================

begin;

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
  v_warning_message text := nullif(trim(coalesce(p_message, '')), '');
  v_warning_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_post_title text;
  v_post_body text;
  v_post_excerpt text;
  v_post_available boolean := false;
  v_report_reason text;
begin
  if not public.is_moderator_or_above() then
    raise exception 'Moderator permission required';
  end if;

  if not exists (select 1 from public.moderation_assert_target_profile(p_target_user_id)) then
    raise exception 'Target user not found';
  end if;

  if p_related_post_id is not null then
    select
      nullif(trim(coalesce(p.title, '')), ''),
      nullif(trim(coalesce(p.body, '')), ''),
      coalesce(p.is_deleted, false) = false and p.visibility = 'public'
    into v_post_title, v_post_body, v_post_available
    from public.posts p
    where p.id = p_related_post_id
      and p.user_id = p_target_user_id;
  end if;

  v_post_excerpt := nullif(trim(coalesce(v_post_body, '')), '');

  if v_post_excerpt is not null and char_length(v_post_excerpt) > 160 then
    v_post_excerpt := trim(left(v_post_excerpt, 160)) || '...';
  end if;

  if p_related_report_id is not null then
    select nullif(trim(coalesce(pr.reason, '')), '')
    into v_report_reason
    from public.post_reports pr
    where pr.id = p_related_report_id
      and pr.post_id = p_related_post_id;
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
      'post_id', p_related_post_id,
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

revoke all on function public.moderation_warn_user(uuid, text, text, uuid, uuid) from public;
grant execute on function public.moderation_warn_user(uuid, text, text, uuid, uuid) to authenticated;

commit;
