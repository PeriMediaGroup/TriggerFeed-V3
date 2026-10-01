-- Validate the authoritative reply relationship before suppression or notification creation.
-- CREATE OR REPLACE preserves the existing UUID signature and owner.
create or replace function public.create_reply_notification(
  p_parent_comment_id uuid,
  p_reply_comment_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
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

  perform public.assert_current_user_can_interact();

  -- SECURITY DEFINER bypasses RLS: enforce actor ownership and the comments
  -- SELECT policy's live/public post boundary here, as well as the relationship.
  select parent.user_id, reply.post_id
  into v_parent_owner_id, v_post_id
  from public.comments as reply
  join public.comments as parent on parent.id = reply.parent_comment_id
  join public.posts as post on post.id = reply.post_id
  where reply.id = p_reply_comment_id
    and reply.user_id = v_actor_id
    and reply.parent_comment_id = p_parent_comment_id
    and parent.post_id = reply.post_id
    and parent.parent_comment_id is null
    and reply.is_deleted = false
    and parent.is_deleted = false
    and post.is_deleted = false
    and post.visibility = 'public';

  if not found then
    -- Do not distinguish missing, inaccessible, deleted or mismatched records.
    raise exception 'Reply notification denied';
  end if;

  if v_parent_owner_id = v_actor_id then
    return null;
  end if;

  if not public.should_create_notification(v_parent_owner_id, 'reply') then
    return null;
  end if;

  insert into public.notifications (
    user_id, actor_id, type, post_id, comment_id, title, body, metadata
  )
  values (
    v_parent_owner_id, v_actor_id, 'reply', v_post_id, p_reply_comment_id,
    'New reply', 'replied to your comment',
    pg_catalog.jsonb_build_object('source', 'reply', 'parent_comment_id', p_parent_comment_id)
  )
  on conflict do nothing
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;

-- Supabase default privileges may grant anon explicitly; revoking PUBLIC alone
-- does not remove that grant. Preserve authenticated callers, narrow anonymous access.
revoke execute on function public.create_reply_notification(uuid, uuid) from public, anon;
grant execute on function public.create_reply_notification(uuid, uuid) to authenticated;
