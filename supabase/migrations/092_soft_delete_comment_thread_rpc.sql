begin;

create or replace function public.soft_delete_comment_thread(target_comment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_comment record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select c.id, c.post_id, c.user_id, c.is_deleted
  into target_comment
  from public.comments c
  where c.id = target_comment_id;

  if target_comment is null then
    raise exception 'Comment not found';
  end if;

  if target_comment.user_id <> auth.uid() then
    raise exception 'You do not have permission to delete this comment';
  end if;

  if target_comment.is_deleted = true then
    raise exception 'Comment is already deleted';
  end if;

  update public.comments
  set
    body = '[deleted]',
    is_deleted = true,
    deleted_at = now(),
    updated_at = now()
  where post_id = target_comment.post_id
    and is_deleted = false
    and (
      id = target_comment.id
      or parent_comment_id = target_comment.id
    );

  return target_comment.id;
end;
$$;

revoke execute on function public.soft_delete_comment_thread(uuid) from public;
grant execute on function public.soft_delete_comment_thread(uuid) to authenticated;

commit;
