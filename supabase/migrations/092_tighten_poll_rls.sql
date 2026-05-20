-- ------------------------------------------------------------
-- Stage 092: Tighten poll RLS
-- Polls, poll options, and poll responses should only be readable
-- when their parent post is public and not soft-deleted.
--
-- Poll responses should only be created/updated by the authenticated
-- user, and only for visible public posts.
-- ------------------------------------------------------------

-- -----------------------------
-- polls: read only visible parent posts
-- -----------------------------
drop policy if exists "Anyone can read polls" on public.polls;
drop policy if exists "Anyone can read visible polls" on public.polls;

create policy "Anyone can read visible polls"
on public.polls
for select
using (
  exists (
    select 1
    from public.posts p
    where p.id = polls.post_id
      and p.is_deleted = false
      and p.visibility = 'public'
  )
);

-- Keep/create poll insert policy, but make public visibility explicit.
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
      and p.visibility = 'public'
  )
);

-- -----------------------------
-- poll_options: read only visible parent posts
-- -----------------------------
drop policy if exists "Anyone can read poll options" on public.poll_options;
drop policy if exists "Anyone can read visible poll options" on public.poll_options;

create policy "Anyone can read visible poll options"
on public.poll_options
for select
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

-- Keep/create option insert policy, but make public visibility explicit.
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
      and p.visibility = 'public'
  )
);

-- -----------------------------
-- poll_responses: read only visible parent posts
-- -----------------------------
drop policy if exists "Anyone can read poll responses" on public.poll_responses;
drop policy if exists "Anyone can read visible poll responses" on public.poll_responses;

create policy "Anyone can read visible poll responses"
on public.poll_responses
for select
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

-- -----------------------------
-- poll_responses: create only own response
-- and only for visible parent posts
-- -----------------------------
drop policy if exists "Users can create their own poll responses" on public.poll_responses;

create policy "Users can create their own poll responses"
on public.poll_responses
for insert
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

-- -----------------------------
-- poll_responses: update only own response
-- and only for visible parent posts
-- -----------------------------
drop policy if exists "Users can update their own poll responses" on public.poll_responses;

create policy "Users can update their own poll responses"
on public.poll_responses
for update
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

-- -----------------------------
-- poll_responses: delete only own response
-- and only for visible parent posts
-- -----------------------------
drop policy if exists "Users can delete their own poll responses" on public.poll_responses;

create policy "Users can delete their own poll responses"
on public.poll_responses
for delete
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