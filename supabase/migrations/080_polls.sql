-- =========================================================
-- 080: Polls, Poll Options, and Poll Responses
-- =========================================================

begin;

create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  question text not null,
  allows_multiple boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint polls_question_length
    check (char_length(trim(question)) between 1 and 180)
);

create table if not exists public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  option_text text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),

  constraint poll_options_text_length
    check (char_length(trim(option_text)) between 1 and 120),

  constraint poll_options_display_order_check
    check (display_order >= 0)
);

create table if not exists public.poll_responses (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  option_id uuid not null references public.poll_options(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),

  constraint poll_responses_unique_poll_user
    unique (poll_id, user_id)
);

create index if not exists polls_post_id_idx
on public.polls(post_id);

create index if not exists poll_options_poll_id_display_order_idx
on public.poll_options(poll_id, display_order);

create index if not exists poll_responses_poll_id_idx
on public.poll_responses(poll_id);

create index if not exists poll_responses_option_id_idx
on public.poll_responses(option_id);

create index if not exists poll_responses_user_id_idx
on public.poll_responses(user_id);

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_responses enable row level security;

revoke all on public.polls from anon;
revoke all on public.polls from authenticated;
revoke all on public.poll_options from anon;
revoke all on public.poll_options from authenticated;
revoke all on public.poll_responses from anon;
revoke all on public.poll_responses from authenticated;

grant select on public.polls to anon, authenticated;
grant select on public.poll_options to anon, authenticated;
grant select on public.poll_responses to anon, authenticated;

grant insert on public.polls to authenticated;
grant insert on public.poll_options to authenticated;
grant insert, update, delete on public.poll_responses to authenticated;

create policy "polls_select_visible_public_posts"
on public.polls
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.posts p
    where p.id = polls.post_id
      and p.is_deleted = false
      and p.visibility = 'public'
  )
);

create policy "polls_insert_own_public_post"
on public.polls
for insert
to authenticated
with check (
  exists (
    select 1
    from public.posts p
    where p.id = polls.post_id
      and p.user_id = auth.uid()
      and p.is_deleted = false
      and p.visibility = 'public'
  )
);

create policy "poll_options_select_visible_public_posts"
on public.poll_options
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.polls po
    join public.posts p on p.id = po.post_id
    where po.id = poll_options.poll_id
      and p.is_deleted = false
      and p.visibility = 'public'
  )
);

create policy "poll_options_insert_own_public_post"
on public.poll_options
for insert
to authenticated
with check (
  exists (
    select 1
    from public.polls po
    join public.posts p on p.id = po.post_id
    where po.id = poll_options.poll_id
      and p.user_id = auth.uid()
      and p.is_deleted = false
      and p.visibility = 'public'
  )
);

create policy "poll_responses_select_visible_public_posts"
on public.poll_responses
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.polls po
    join public.posts p on p.id = po.post_id
    where po.id = poll_responses.poll_id
      and p.is_deleted = false
      and p.visibility = 'public'
  )
);

create policy "poll_responses_insert_own_visible_public_post"
on public.poll_responses
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.poll_options po
    join public.polls poll on poll.id = po.poll_id
    join public.posts p on p.id = poll.post_id
    where po.id = poll_responses.option_id
      and po.poll_id = poll_responses.poll_id
      and p.is_deleted = false
      and p.visibility = 'public'
  )
);

create policy "poll_responses_update_own_visible_public_post"
on public.poll_responses
for update
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.polls po
    join public.posts p on p.id = po.post_id
    where po.id = poll_responses.poll_id
      and p.is_deleted = false
      and p.visibility = 'public'
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.poll_options po
    join public.polls poll on poll.id = po.poll_id
    join public.posts p on p.id = poll.post_id
    where po.id = poll_responses.option_id
      and po.poll_id = poll_responses.poll_id
      and p.is_deleted = false
      and p.visibility = 'public'
  )
);

create policy "poll_responses_delete_own_visible_public_post"
on public.poll_responses
for delete
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.polls po
    join public.posts p on p.id = po.post_id
    where po.id = poll_responses.poll_id
      and p.is_deleted = false
      and p.visibility = 'public'
  )
);

commit;
