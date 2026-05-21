-- =========================================================
-- Stage 3: Comment Replies
-- Adds parent comment support for one-level replies.
-- =========================================================

alter table public.comments
add column if not exists parent_comment_id uuid
references public.comments(id)
on delete cascade;

alter table public.comments
drop constraint if exists comments_no_self_reply;

alter table public.comments
add constraint comments_no_self_reply
check (
  parent_comment_id is null
  or parent_comment_id <> id
);

create index if not exists comments_parent_comment_id_idx
on public.comments(parent_comment_id);

create index if not exists comments_post_id_parent_comment_id_idx
on public.comments(post_id, parent_comment_id);

-- Prevent replies to replies.
-- A comment can reply to a top-level comment only.
create or replace function public.prevent_reply_to_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_parent_id uuid;
begin
  if new.parent_comment_id is null then
    return new;
  end if;

  select c.parent_comment_id
  into parent_parent_id
  from public.comments c
  where c.id = new.parent_comment_id;

  if parent_parent_id is not null then
    raise exception 'Replies to replies are not allowed';
  end if;

  return new;
end;
$$;

revoke execute on function public.prevent_reply_to_reply() from anon, authenticated;

drop trigger if exists prevent_reply_to_reply_trigger on public.comments;

create trigger prevent_reply_to_reply_trigger
before insert or update of parent_comment_id
on public.comments
for each row
execute function public.prevent_reply_to_reply();
