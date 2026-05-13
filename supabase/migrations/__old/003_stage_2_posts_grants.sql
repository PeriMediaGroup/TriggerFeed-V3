-- Stage 2 grants and RLS policies for posts, comments, and post audit logs.

-- Allow app roles to use the public schema.
grant usage on schema public to authenticated;
grant usage on schema public to anon;

-- Posts table permissions.
grant select on public.posts to anon;
grant select on public.posts to authenticated;
grant insert on public.posts to authenticated;
grant update on public.posts to authenticated;
revoke delete on public.posts from anon;
revoke delete on public.posts from authenticated;

-- Comments table permissions.
grant select on public.comments to anon;
grant select on public.comments to authenticated;
grant insert on public.comments to authenticated;
grant update on public.comments to authenticated;
revoke delete on public.comments from anon;
revoke delete on public.comments from authenticated;

-- Audit logs are write-only for regular app users.
revoke all on public.post_audit_logs from anon;
revoke all on public.post_audit_logs from authenticated;
grant insert on public.post_audit_logs to authenticated;

alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.post_audit_logs enable row level security;

drop policy if exists "Anyone can read non-deleted public posts"
on public.posts;

create policy "Anyone can read non-deleted public posts"
on public.posts
for select
to anon, authenticated
using (
  is_deleted = false
  and visibility = 'public'
);

drop policy if exists "Authenticated users can insert their own public posts"
on public.posts;

create policy "Authenticated users can insert their own public posts"
on public.posts
for insert
to authenticated
with check (
  auth.uid() = user_id
  and visibility = 'public'
  and is_deleted = false
  and deleted_at is null
);

drop policy if exists "Authenticated users can update their own non-deleted posts"
on public.posts;

create policy "Authenticated users can update their own non-deleted posts"
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

drop policy if exists "Anyone can read comments on visible public posts"
on public.comments;

create policy "Anyone can read comments on visible public posts"
on public.comments
for select
to anon, authenticated
using (
  is_deleted = false
  and exists (
    select 1
    from public.posts
    where posts.id = comments.post_id
      and posts.is_deleted = false
      and posts.visibility = 'public'
  )
);

drop policy if exists "Authenticated users can comment on visible public posts"
on public.comments;

create policy "Authenticated users can comment on visible public posts"
on public.comments
for insert
to authenticated
with check (
  auth.uid() = user_id
  and is_deleted = false
  and deleted_at is null
  and exists (
    select 1
    from public.posts
    where posts.id = comments.post_id
      and posts.is_deleted = false
      and posts.visibility = 'public'
  )
);

drop policy if exists "Authenticated users can update their own non-deleted comments"
on public.comments;

create policy "Authenticated users can update their own non-deleted comments"
on public.comments
for update
to authenticated
using (
  auth.uid() = user_id
  and is_deleted = false
)
with check (
  auth.uid() = user_id
  and (
    (is_deleted = false and deleted_at is null)
    or
    (is_deleted = true and deleted_at is not null)
  )
  and exists (
    select 1
    from public.posts
    where posts.id = comments.post_id
      and posts.is_deleted = false
      and posts.visibility = 'public'
  )
);

drop policy if exists "Authenticated users can insert their own post audit logs"
on public.post_audit_logs;

create policy "Authenticated users can insert their own post audit logs"
on public.post_audit_logs
for insert
to authenticated
with check (
  auth.uid() = user_id
);
