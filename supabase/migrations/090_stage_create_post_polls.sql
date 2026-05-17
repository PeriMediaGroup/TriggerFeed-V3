create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  question text not null,
  allows_multiple boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint polls_question_length check (
    char_length(trim(question)) between 1 and 180
  )
);

create table if not exists public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  option_text text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),

  constraint poll_options_text_length check (
    char_length(trim(option_text)) between 1 and 120
  )
);

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;

grant select on public.polls to anon, authenticated;
grant select on public.poll_options to anon, authenticated;

grant insert on public.polls to authenticated;
grant insert on public.poll_options to authenticated;

drop policy if exists "Anyone can read polls" on public.polls;
create policy "Anyone can read polls"
on public.polls
for select
using (true);

drop policy if exists "Post owners can create polls" on public.polls;
create policy "Post owners can create polls"
on public.polls
for insert
with check (
  exists (
    select 1
    from public.posts p
    where p.id = polls.post_id
      and p.user_id = auth.uid()
      and p.is_deleted = false
  )
);

drop policy if exists "Anyone can read poll options" on public.poll_options;
create policy "Anyone can read poll options"
on public.poll_options
for select
using (true);

drop policy if exists "Post owners can create poll options" on public.poll_options;
create policy "Post owners can create poll options"
on public.poll_options
for insert
with check (
  exists (
    select 1
    from public.polls po
    join public.posts p on p.id = po.post_id
    where po.id = poll_options.poll_id
      and p.user_id = auth.uid()
      and p.is_deleted = false
  )
);

create index if not exists polls_post_id_idx
on public.polls(post_id);

create index if not exists poll_options_poll_id_display_order_idx
on public.poll_options(poll_id, display_order);