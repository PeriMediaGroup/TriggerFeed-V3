create table if not exists public.poll_responses (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  option_id uuid not null references public.poll_options(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),

  unique (poll_id, user_id)
);

alter table public.poll_responses enable row level security;

grant select on public.poll_responses to anon, authenticated;
grant insert on public.poll_responses to authenticated;
grant update on public.poll_responses to authenticated;
grant delete on public.poll_responses to authenticated;

drop policy if exists "Anyone can read poll responses" on public.poll_responses;
create policy "Anyone can read poll responses"
on public.poll_responses
for select
using (true);

drop policy if exists "Users can create their own poll responses" on public.poll_responses;
create policy "Users can create their own poll responses"
on public.poll_responses
for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.poll_options po
    where po.id = poll_responses.option_id
      and po.poll_id = poll_responses.poll_id
  )
);

drop policy if exists "Users can update their own poll responses" on public.poll_responses;
create policy "Users can update their own poll responses"
on public.poll_responses
for update
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.poll_options po
    where po.id = poll_responses.option_id
      and po.poll_id = poll_responses.poll_id
  )
);

drop policy if exists "Users can delete their own poll responses" on public.poll_responses;
create policy "Users can delete their own poll responses"
on public.poll_responses
for delete
using (user_id = auth.uid());

create index if not exists poll_responses_poll_id_idx
on public.poll_responses(poll_id);

create index if not exists poll_responses_option_id_idx
on public.poll_responses(option_id);

create index if not exists poll_responses_user_id_idx
on public.poll_responses(user_id);