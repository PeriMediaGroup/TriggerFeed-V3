-- =========================================================
-- Stage 5: Post Votes
-- Adds one vote per user per post and vote count helpers.
-- Current app expects vote_type + toggle_post_vote(target_post_id, target_vote_type).
-- =========================================================

create table if not exists public.post_votes (
  id uuid primary key default gen_random_uuid(),

  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,

  vote_type text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint post_votes_vote_type_check
    check (vote_type in ('upvote', 'downvote')),

  constraint post_votes_unique_user_post
    unique (post_id, user_id)
);

create or replace function public.set_post_votes_updated_at()
returns trigger
language plpgsql
set search_path = public
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

revoke all on public.post_votes from anon;
revoke all on public.post_votes from authenticated;

grant select (post_id, vote_type) on public.post_votes to anon;
grant select on public.post_votes to authenticated;
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

create index if not exists post_votes_post_id_vote_type_idx
on public.post_votes(post_id, vote_type);

drop view if exists public.post_vote_counts;

create or replace view public.post_vote_counts
with (security_invoker = true)
as
select
  p.id as post_id,

  count(pv.id) filter (
    where pv.vote_type = 'upvote'
  )::integer as upvote_count,

  count(pv.id) filter (
    where pv.vote_type = 'downvote'
  )::integer as downvote_count,

  (
    count(pv.id) filter (
      where pv.vote_type = 'upvote'
    )
    -
    count(pv.id) filter (
      where pv.vote_type = 'downvote'
    )
  )::integer as score,

  (
    count(pv.id) filter (
      where pv.vote_type = 'upvote'
    )
    -
    count(pv.id) filter (
      where pv.vote_type = 'downvote'
    )
  )::integer as vote_score,

  count(pv.id)::integer as vote_count,

  count(pv.id)::integer as interaction_count

from public.posts p
left join public.post_votes pv
  on pv.post_id = p.id
group by p.id;

grant select on public.post_vote_counts to anon, authenticated;

create or replace function public.toggle_post_vote(
  target_post_id uuid,
  target_vote_type text
)
returns table (
  post_id uuid,
  user_vote text,
  score integer,
  vote_score integer,
  vote_count integer,
  upvote_count integer,
  downvote_count integer,
  interaction_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_vote_type text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if target_vote_type not in ('upvote', 'downvote') then
    raise exception 'Vote type must be upvote or downvote';
  end if;

  if not exists (
    select 1
    from public.posts p
    where p.id = target_post_id
      and p.is_deleted = false
      and p.visibility = 'public'
  ) then
    raise exception 'Post not found or not votable';
  end if;

  select pv.vote_type
  into existing_vote_type
  from public.post_votes pv
  where pv.post_id = target_post_id
    and pv.user_id = auth.uid();

  if existing_vote_type = target_vote_type then
    delete from public.post_votes pv
    where pv.post_id = target_post_id
      and pv.user_id = auth.uid();

  elsif existing_vote_type is null then
    insert into public.post_votes (
      post_id,
      user_id,
      vote_type
    )
    values (
      target_post_id,
      auth.uid(),
      target_vote_type
    );

  else
    update public.post_votes pv
    set vote_type = target_vote_type
    where pv.post_id = target_post_id
      and pv.user_id = auth.uid();
  end if;

  return query
  select
    pvc.post_id,

    (
      select pv.vote_type
      from public.post_votes pv
      where pv.post_id = target_post_id
        and pv.user_id = auth.uid()
    ) as user_vote,

    pvc.score,
    pvc.vote_score,
    pvc.vote_count,
    pvc.upvote_count,
    pvc.downvote_count,
    pvc.interaction_count
  from public.post_vote_counts pvc
  where pvc.post_id = target_post_id;
end;
$$;

grant execute on function public.toggle_post_vote(uuid, text)
to authenticated;
