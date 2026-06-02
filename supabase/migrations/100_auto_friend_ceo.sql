-- Auto-connect new users with the active CEO profile.
-- This does not rely on username = 'TF-One'.
-- Source of truth is profiles.role = 'ceo'.

create unique index if not exists friends_unique_profile_pair
on public.friends (
  least(requester_id, addressee_id),
  greatest(requester_id, addressee_id)
);

create or replace function public.auto_friend_ceo_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ceo_profile_id uuid;
begin
  select id
  into ceo_profile_id
  from public.profiles
  where role = 'ceo'
    and coalesce(is_deleted, false) = false
  order by created_at asc
  limit 1;

  -- No CEO exists yet. Do nothing.
  if ceo_profile_id is null then
    return new;
  end if;

  -- Do not friend the CEO to themselves.
  if ceo_profile_id = new.id then
    return new;
  end if;

  insert into public.friends (
    id,
    requester_id,
    addressee_id,
    status,
    created_at,
    updated_at
  )
  values (
    gen_random_uuid(),
    new.id,
    ceo_profile_id,
    'accepted',
    now(),
    now()
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists auto_friend_ceo_after_profile_insert on public.profiles;

create trigger auto_friend_ceo_after_profile_insert
after insert on public.profiles
for each row
execute function public.auto_friend_ceo_profile();


-- Backfill existing users.
-- Any existing non-deleted user without a CEO friendship gets one.
-- Existing pending CEO relationships are upgraded to accepted.

with ceo as (
  select id
  from public.profiles
  where role = 'ceo'
    and coalesce(is_deleted, false) = false
  order by created_at asc
  limit 1
)
update public.friends f
set
  status = 'accepted',
  updated_at = now()
from ceo
where f.status <> 'accepted'
  and (
    (f.requester_id = ceo.id)
    or (f.addressee_id = ceo.id)
  );


with ceo as (
  select id
  from public.profiles
  where role = 'ceo'
    and coalesce(is_deleted, false) = false
  order by created_at asc
  limit 1
)
insert into public.friends (
  id,
  requester_id,
  addressee_id,
  status,
  created_at,
  updated_at
)
select
  gen_random_uuid(),
  p.id,
  ceo.id,
  'accepted',
  now(),
  now()
from public.profiles p
cross join ceo
where p.id <> ceo.id
  and coalesce(p.is_deleted, false) = false
  and not exists (
    select 1
    from public.friends f
    where (
      f.requester_id = p.id
      and f.addressee_id = ceo.id
    )
    or (
      f.requester_id = ceo.id
      and f.addressee_id = p.id
    )
  )
on conflict do nothing;