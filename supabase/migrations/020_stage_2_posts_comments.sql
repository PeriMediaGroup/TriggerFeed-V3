-- Stage 2 posts/comments foundation.
-- This migration intentionally keeps visibility restricted to public posts
-- until friends/private permissions are designed in app code and RLS.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  visibility text not null default 'public',
  is_deleted boolean not null default false,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.posts
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists title text,
  add column if not exists body text,
  add column if not exists visibility text default 'public',
  add column if not exists is_deleted boolean default false,
  add column if not exists deleted_at timestamp with time zone,
  add column if not exists created_at timestamp with time zone default now(),
  add column if not exists updated_at timestamp with time zone default now();

update public.posts
set
  title = coalesce(nullif(trim(title), ''), 'Untitled post'),
  visibility = coalesce(visibility, 'public'),
  is_deleted = coalesce(is_deleted, false),
  deleted_at = case
    when is_deleted = true then coalesce(deleted_at, updated_at, now())
    else deleted_at
  end,
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

alter table public.posts
  alter column user_id set not null,
  alter column title set not null,
  alter column visibility set default 'public',
  alter column visibility set not null,
  alter column is_deleted set default false,
  alter column is_deleted set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'posts_title_length_check'
      and conrelid = 'public.posts'::regclass
  ) then
    alter table public.posts
      add constraint posts_title_length_check
      check (char_length(title) <= 120);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'posts_body_length_check'
      and conrelid = 'public.posts'::regclass
  ) then
    alter table public.posts
      add constraint posts_body_length_check
      check (body is null or char_length(body) <= 5000);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'posts_visibility_public_only_check'
      and conrelid = 'public.posts'::regclass
  ) then
    alter table public.posts
      add constraint posts_visibility_public_only_check
      check (visibility = 'public');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'posts_deleted_at_check'
      and conrelid = 'public.posts'::regclass
  ) then
    alter table public.posts
      add constraint posts_deleted_at_check
      check (
        (is_deleted = false and deleted_at is null)
        or
        (is_deleted = true and deleted_at is not null)
      );
  end if;
end;
$$;

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

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  is_deleted boolean not null default false,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.comments
  add column if not exists post_id uuid references public.posts(id) on delete cascade,
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists body text,
  add column if not exists is_deleted boolean default false,
  add column if not exists deleted_at timestamp with time zone,
  add column if not exists created_at timestamp with time zone default now(),
  add column if not exists updated_at timestamp with time zone default now();

update public.comments
set
  body = coalesce(body, ''),
  is_deleted = coalesce(is_deleted, false),
  deleted_at = case
    when is_deleted = true then coalesce(deleted_at, updated_at, now())
    else deleted_at
  end,
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

alter table public.comments
  alter column post_id set not null,
  alter column user_id set not null,
  alter column body set not null,
  alter column is_deleted set default false,
  alter column is_deleted set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'comments_body_not_blank_check'
      and conrelid = 'public.comments'::regclass
  ) then
    alter table public.comments
      add constraint comments_body_not_blank_check
      check (char_length(trim(body)) > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'comments_body_length_check'
      and conrelid = 'public.comments'::regclass
  ) then
    alter table public.comments
      add constraint comments_body_length_check
      check (char_length(body) <= 5000);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'comments_deleted_at_check'
      and conrelid = 'public.comments'::regclass
  ) then
    alter table public.comments
      add constraint comments_deleted_at_check
      check (
        (is_deleted = false and deleted_at is null)
        or
        (is_deleted = true and deleted_at is not null)
      );
  end if;
end;
$$;

drop trigger if exists set_comments_updated_at on public.comments;
create trigger set_comments_updated_at
before update on public.comments
for each row
execute function public.set_updated_at();

create index if not exists comments_visible_by_post_created_at_idx
  on public.comments (post_id, created_at)
  where is_deleted = false;

create index if not exists comments_user_id_idx
  on public.comments (user_id);

create table if not exists public.post_audit_logs (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  success boolean not null,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

alter table public.post_audit_logs
  add column if not exists post_id uuid references public.posts(id) on delete set null,
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists event_type text,
  add column if not exists success boolean,
  add column if not exists error_code text,
  add column if not exists error_message text,
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists created_at timestamp with time zone default now();

update public.post_audit_logs
set
  metadata = coalesce(metadata, '{}'::jsonb),
  created_at = coalesce(created_at, now());

alter table public.post_audit_logs
  alter column user_id set not null,
  alter column event_type set not null,
  alter column success set not null,
  alter column metadata set default '{}'::jsonb,
  alter column metadata set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'post_audit_logs_event_type_not_blank_check'
      and conrelid = 'public.post_audit_logs'::regclass
  ) then
    alter table public.post_audit_logs
      add constraint post_audit_logs_event_type_not_blank_check
      check (char_length(trim(event_type)) > 0);
  end if;
end;
$$;

create index if not exists post_audit_logs_post_id_idx
  on public.post_audit_logs (post_id);

create index if not exists post_audit_logs_user_id_idx
  on public.post_audit_logs (user_id);

create index if not exists post_audit_logs_created_at_idx
  on public.post_audit_logs (created_at desc);

create index if not exists post_audit_logs_event_type_idx
  on public.post_audit_logs (event_type);
