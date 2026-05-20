-- =========================================================
-- 050: Friends
-- =========================================================

begin;

create table if not exists public.friends (
  id uuid primary key default gen_random_uuid(),

  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,

  status text not null default 'pending',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint friends_status_check
    check (status in ('pending', 'accepted', 'declined', 'blocked')),

  constraint friends_no_self_request
    check (requester_id <> addressee_id),

  constraint friends_unique_pair
    unique (requester_id, addressee_id)
);

create or replace function public.set_friends_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_friends_updated_at on public.friends;
create trigger set_friends_updated_at
before update on public.friends
for each row
execute function public.set_friends_updated_at();

create index if not exists friends_requester_id_idx
on public.friends(requester_id);

create index if not exists friends_addressee_id_idx
on public.friends(addressee_id);

create index if not exists friends_status_idx
on public.friends(status);

create index if not exists friends_requester_addressee_status_idx
on public.friends(requester_id, addressee_id, status);

alter table public.friends enable row level security;

revoke all on public.friends from anon;
revoke all on public.friends from authenticated;

grant select, insert, delete on table public.friends to authenticated;
grant update (status, updated_at) on public.friends to authenticated;

create policy "friends_select_involved_users"
on public.friends
for select
to authenticated
using (
  auth.uid() = requester_id
  or auth.uid() = addressee_id
);

create policy "friends_insert_pending_only_by_requester"
on public.friends
for insert
to authenticated
with check (
  auth.uid() = requester_id
  and requester_id <> addressee_id
  and status = 'pending'
);

create policy "friends_addressee_updates_pending_request"
on public.friends
for update
to authenticated
using (
  auth.uid() = addressee_id
  and status = 'pending'
)
with check (
  auth.uid() = addressee_id
  and status in ('accepted', 'declined')
);

create policy "friends_requester_can_cancel_pending_request"
on public.friends
for delete
to authenticated
using (
  auth.uid() = requester_id
  and status = 'pending'
);

create policy "friends_either_user_can_remove_accepted_friendship"
on public.friends
for delete
to authenticated
using (
  status = 'accepted'
  and (
    auth.uid() = requester_id
    or auth.uid() = addressee_id
  )
);

-- Public profile pages need friend counts, not raw friends rows.
create or replace function public.get_profile_friend_count(target_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.friends
  where status = 'accepted'
    and (
      requester_id = target_user_id
      or addressee_id = target_user_id
    );
$$;

revoke all on function public.get_profile_friend_count(uuid) from public;
grant execute on function public.get_profile_friend_count(uuid) to anon, authenticated;

commit;
