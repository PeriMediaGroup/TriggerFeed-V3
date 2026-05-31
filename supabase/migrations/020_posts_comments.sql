-- =========================================================
-- 020: Posts, Comments, Replies, and Post Audit Logs
-- =========================================================

begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------
-- Posts
-- ---------------------------------------------------------

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  body text,
  visibility text not null default 'public',
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

constraint posts_title_or_body_required_check
  check (
    nullif(trim(coalesce(title, '')), '') is not null
    or
    nullif(trim(coalesce(body, '')), '') is not null
  ),

constraint posts_title_length_check
  check (title is null or char_length(title) <= 120),

constraint posts_body_length_check
  check (body is null or char_length(body) <= 5000),

  constraint posts_visibility_public_only_check
    check (visibility = 'public'),

  constraint posts_deleted_at_check
    check (
      (is_deleted = false and deleted_at is null)
      or
      (is_deleted = true and deleted_at is not null)
    )
);

drop trigger if exists set_posts_updated_at on public.posts;
create trigger set_posts_updated_at
before update on public.posts
for each row
execute function public.set_updated_at();

create index if not exists posts_public_feed_idx
on public.posts (created_at desc)
where is_deleted = false and visibility = 'public';

create index if not exists posts_user_id_idx
on public.posts (user_id);

create index if not exists posts_visibility_deleted_created_at_idx
on public.posts (visibility, is_deleted, created_at desc);

alter table public.posts enable row level security;

revoke all on public.posts from anon;
revoke all on public.posts from authenticated;

grant select on public.posts to anon, authenticated;
grant insert, update on public.posts to authenticated;

create policy "posts_select_visible_public"
on public.posts
for select
to anon, authenticated
using (
  is_deleted = false
  and visibility = 'public'
);

create policy "posts_insert_own_public"
on public.posts
for insert
to authenticated
with check (
  auth.uid() = user_id
  and visibility = 'public'
  and is_deleted = false
  and deleted_at is null
);

create policy "posts_update_own_non_deleted"
on public.posts
for update
to authenticated
using (
  auth.uid() = user_id
  and is_deleted = false
)
with check (
  auth.uid() = user_id
  and visibility = 'public'
  and (
    (is_deleted = false and deleted_at is null)
    or
    (is_deleted = true and deleted_at is not null)
  )
);

-- Soft delete through RPC so the app does not need direct delete grants.
create or replace function public.soft_delete_post(target_post_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_post_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.posts
  set
    is_deleted = true,
    deleted_at = now(),
    updated_at = now()
  where id = target_post_id
    and user_id = auth.uid()
    and is_deleted = false
  returning id into deleted_post_id;

  if deleted_post_id is null then
    raise exception 'Post not found or you do not have permission to delete it';
  end if;

  return deleted_post_id;
end;
$$;

revoke execute on function public.soft_delete_post(uuid) from public;
grant execute on function public.soft_delete_post(uuid) to authenticated;

-- ---------------------------------------------------------
-- Comments and one-level replies
-- ---------------------------------------------------------

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_comment_id uuid references public.comments(id) on delete cascade,
  body text not null,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint comments_no_self_reply
    check (parent_comment_id is null or parent_comment_id <> id),

  constraint comments_body_not_blank_check
    check (char_length(trim(body)) > 0),

  constraint comments_body_length_check
    check (char_length(body) <= 5000),

  constraint comments_deleted_at_check
    check (
      (is_deleted = false and deleted_at is null)
      or
      (is_deleted = true and deleted_at is not null)
    )
);

drop trigger if exists set_comments_updated_at on public.comments;
create trigger set_comments_updated_at
before update on public.comments
for each row
execute function public.set_updated_at();

create or replace function public.prevent_invalid_comment_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_record record;
begin
  if new.parent_comment_id is null then
    return new;
  end if;

  select c.post_id, c.parent_comment_id, c.is_deleted
  into parent_record
  from public.comments c
  where c.id = new.parent_comment_id;

  if parent_record is null then
    raise exception 'Parent comment not found';
  end if;

  if parent_record.is_deleted = true then
    raise exception 'Cannot reply to a deleted comment';
  end if;

  if parent_record.post_id <> new.post_id then
    raise exception 'Reply parent must belong to the same post';
  end if;

  if parent_record.parent_comment_id is not null then
    raise exception 'Replies to replies are not allowed';
  end if;

  return new;
end;
$$;

revoke execute on function public.prevent_invalid_comment_reply() from anon, authenticated;

drop trigger if exists prevent_invalid_comment_reply_trigger on public.comments;
create trigger prevent_invalid_comment_reply_trigger
before insert or update of parent_comment_id, post_id
on public.comments
for each row
execute function public.prevent_invalid_comment_reply();

create index if not exists comments_visible_by_post_created_at_idx
on public.comments (post_id, created_at)
where is_deleted = false;

create index if not exists comments_user_id_idx
on public.comments (user_id);

create index if not exists comments_parent_comment_id_idx
on public.comments(parent_comment_id);

create index if not exists comments_post_id_parent_comment_id_idx
on public.comments(post_id, parent_comment_id);

alter table public.comments enable row level security;

revoke all on public.comments from anon;
revoke all on public.comments from authenticated;

grant select on public.comments to anon, authenticated;
grant insert on public.comments to authenticated;

revoke update on public.comments from authenticated;

grant update (
  body,
  is_deleted,
  deleted_at,
  updated_at
) on public.comments to authenticated;

create policy "comments_select_visible_public_post"
on public.comments
for select
to anon, authenticated
using (
  is_deleted = false
  and exists (
    select 1
    from public.posts p
    where p.id = comments.post_id
      and p.is_deleted = false
      and p.visibility = 'public'
  )
);

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
    from public.posts p
    where p.id = comments.post_id
      and p.is_deleted = false
      and p.visibility = 'public'
  )
);

create policy "comments_update_own_non_deleted"
on public.comments
for update
to authenticated
using (
  auth.uid() = user_id
  and is_deleted = false
)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.posts p
    where p.id = comments.post_id
      and p.is_deleted = false
      and p.visibility = 'public'
  )
  and (
    (is_deleted = false and deleted_at is null)
    or
    (is_deleted = true and deleted_at is not null)
  )
);

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

-- ---------------------------------------------------------
-- Post audit logs
-- ---------------------------------------------------------

create table if not exists public.post_audit_logs (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  success boolean not null,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint post_audit_logs_event_type_not_blank_check
    check (char_length(trim(event_type)) > 0)
);

create index if not exists post_audit_logs_post_id_idx
on public.post_audit_logs (post_id);

create index if not exists post_audit_logs_user_id_idx
on public.post_audit_logs (user_id);

create index if not exists post_audit_logs_created_at_idx
on public.post_audit_logs (created_at desc);

create index if not exists post_audit_logs_event_type_idx
on public.post_audit_logs (event_type);

alter table public.post_audit_logs enable row level security;

revoke all on public.post_audit_logs from anon;
revoke all on public.post_audit_logs from authenticated;

grant insert on public.post_audit_logs to authenticated;

create policy "post_audit_logs_insert_own"
on public.post_audit_logs
for insert
to authenticated
with check (auth.uid() = user_id);

commit;
