-- =========================================================
-- Stage 4: Post Votes
-- Adds one vote per user per post and vote count helpers.
-- =========================================================

create table if not exists public.post_votes (
  id uuid primary key default gen_random_uuid(),

  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,

  value integer not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint post_votes_value_check
    check (value in (-1, 1)),

  constraint post_votes_unique_user_post
    unique (post_id, user_id)
);

create or replace function public.set_post_votes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_post_votes_updated_at on public.post_votes;

create trigger set_post_votes_updated_at
before update on public.post_votes
for each row
execute function public.set_post_votes_updated_at();

alter table public.post_votes enable row level security;

grant select on public.post_votes to anon, authenticated;
grant insert, update, delete on public.post_votes to authenticated;

drop policy if exists "Anyone can read post votes"
on public.post_votes;

create policy "Anyone can read post votes"
on public.post_votes
for select
using (true);

drop policy if exists "Authenticated users can insert their own post votes"
on public.post_votes;

create policy "Authenticated users can insert their own post votes"
on public.post_votes
for insert
to authenticated
with check (
  auth.uid() = user_id
);

drop policy if exists "Authenticated users can update their own post votes"
on public.post_votes;

create policy "Authenticated users can update their own post votes"
on public.post_votes
for update
to authenticated
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);

drop policy if exists "Authenticated users can delete their own post votes"
on public.post_votes;

create policy "Authenticated users can delete their own post votes"
on public.post_votes
for delete
to authenticated
using (
  auth.uid() = user_id
);

create index if not exists post_votes_post_id_idx
on public.post_votes(post_id);

create index if not exists post_votes_user_id_idx
on public.post_votes(user_id);

drop view if exists public.post_vote_counts;

create view public.post_vote_counts as
select
  p.id as post_id,
  coalesce(sum(pv.value), 0)::integer as vote_score,
  count(pv.id)::integer as vote_count,
  count(*) filter (where pv.value = 1)::integer as upvote_count,
  count(*) filter (where pv.value = -1)::integer as downvote_count
from public.posts p
left join public.post_votes pv
  on pv.post_id = p.id
group by p.id;

grant select on public.post_vote_counts to anon, authenticated;

create or replace function public.toggle_post_vote(
  p_post_id uuid,
  p_value integer
)
returns table (
  post_id uuid,
  user_vote integer,
  vote_score integer,
  vote_count integer,
  upvote_count integer,
  downvote_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_vote integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_value not in (-1, 1) then
    raise exception 'Vote value must be -1 or 1';
  end if;

  select pv.value
  into existing_vote
  from public.post_votes pv
  where pv.post_id = p_post_id
    and pv.user_id = auth.uid();

  if existing_vote = p_value then
    delete from public.post_votes pv
    where pv.post_id = p_post_id
      and pv.user_id = auth.uid();
  elsif existing_vote is null then
    insert into public.post_votes (
      post_id,
      user_id,
      value
    )
    values (
      p_post_id,
      auth.uid(),
      p_value
    );
  else
    update public.post_votes pv
    set value = p_value
    where pv.post_id = p_post_id
      and pv.user_id = auth.uid();
  end if;

  return query
  select
    pvc.post_id,
    coalesce((
      select pv.value
      from public.post_votes pv
      where pv.post_id = p_post_id
        and pv.user_id = auth.uid()
    ), 0)::integer as user_vote,
    pvc.vote_score,
    pvc.vote_count,
    pvc.upvote_count,
    pvc.downvote_count
  from public.post_vote_counts pvc
  where pvc.post_id = p_post_id;
end;
$$;

grant execute on function public.toggle_post_vote(uuid, integer)
to authenticated;