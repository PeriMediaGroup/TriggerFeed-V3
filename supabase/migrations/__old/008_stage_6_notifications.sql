-- =========================================================
-- Stage 6: Notifications
-- Adds basic notifications for mentions, comments, and friends.
-- =========================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,

  notification_type text not null,

  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  friend_id uuid references public.friends(id) on delete cascade,

  title text,
  body text,

  is_read boolean not null default false,
  read_at timestamptz,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  constraint notifications_type_check
    check (
      notification_type in (
        'mention',
        'comment',
        'reply',
        'friend_request',
        'friend_accepted',
        'system'
      )
    )
);

alter table public.notifications enable row level security;

grant select, update, delete on public.notifications to authenticated;
grant insert on public.notifications to authenticated;

drop policy if exists "Users can read their own notifications"
on public.notifications;

create policy "Users can read their own notifications"
on public.notifications
for select
to authenticated
using (
  auth.uid() = user_id
);

drop policy if exists "Users can update their own notifications"
on public.notifications;

create policy "Users can update their own notifications"
on public.notifications
for update
to authenticated
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);

drop policy if exists "Users can delete their own notifications"
on public.notifications;

create policy "Users can delete their own notifications"
on public.notifications
for delete
to authenticated
using (
  auth.uid() = user_id
);

drop policy if exists "Authenticated users can create notifications"
on public.notifications;

create policy "Authenticated users can create notifications"
on public.notifications
for insert
to authenticated
with check (
  auth.uid() = actor_id
  or actor_id is null
);

create index if not exists notifications_user_id_idx
on public.notifications(user_id);

create index if not exists notifications_user_id_is_read_created_at_idx
on public.notifications(user_id, is_read, created_at desc);

create index if not exists notifications_actor_id_idx
on public.notifications(actor_id);

create index if not exists notifications_post_id_idx
on public.notifications(post_id);

create index if not exists notifications_comment_id_idx
on public.notifications(comment_id);

-- Helps prevent duplicate mention notifications for same user/context.
create unique index if not exists notifications_unique_mention_context_idx
on public.notifications(
  user_id,
  actor_id,
  notification_type,
  post_id,
  coalesce(comment_id, '00000000-0000-0000-0000-000000000000'::uuid)
)
where notification_type = 'mention';