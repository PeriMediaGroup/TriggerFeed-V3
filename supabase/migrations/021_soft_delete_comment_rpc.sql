begin;

create or replace function public.soft_delete_comment(target_comment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_comment_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.comments
  set
    body = '[deleted]',
    is_deleted = true,
    deleted_at = now(),
    updated_at = now()
  where id = target_comment_id
    and user_id = auth.uid()
    and is_deleted = false
  returning id into deleted_comment_id;

  if deleted_comment_id is null then
    raise exception 'Comment not found or you do not have permission to delete it';
  end if;

  return deleted_comment_id;
end;
$$;

revoke execute on function public.soft_delete_comment(uuid) from public;
grant execute on function public.soft_delete_comment(uuid) to authenticated;

commit;