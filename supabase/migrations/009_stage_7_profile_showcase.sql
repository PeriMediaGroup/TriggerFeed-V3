-- =========================================================
-- Stage 7: Profile Showcase
-- Adds top friends and top guns/profile showcase tables.
-- =========================================================

create table if not exists public.profile_top_friends (
  id uuid primary key default gen_random_uuid(),

  profile_id uuid not null references public.profiles(id) on delete cascade,
  friend_profile_id uuid not null references public.profiles(id) on delete cascade,

  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profile_top_friends_no_self
    check (profile_id <> friend_profile_id),

  constraint profile_top_friends_sort_order_check
    check (sort_order >= 0),

  constraint profile_top_friends_unique_friend
    unique (profile_id, friend_profile_id),

  constraint profile_top_friends_unique_order
    unique (profile_id, sort_order)
);

create table if not exists public.profile_top_guns (
  id uuid primary key default gen_random_uuid(),

  profile_id uuid not null references public.profiles(id) on delete cascade,

  name text not null,
  description text,
  image_cloudinary_url text,
  image_cloudinary_public_id text,

  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profile_top_guns_sort_order_check
    check (sort_order >= 0),

  constraint profile_top_guns_unique_order
    unique (profile_id, sort_order)
);

create or replace function public.set_profile_showcase_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profile_top_friends_updated_at
on public.profile_top_friends;

create trigger set_profile_top_friends_updated_at
before update on public.profile_top_friends
for each row
execute function public.set_profile_showcase_updated_at();

drop trigger if exists set_profile_top_guns_updated_at
on public.profile_top_guns;

create trigger set_profile_top_guns_updated_at
before update on public.profile_top_guns
for each row
execute function public.set_profile_showcase_updated_at();

alter table public.profile_top_friends enable row level security;
alter table public.profile_top_guns enable row level security;

grant select on public.profile_top_friends to anon, authenticated;
grant insert, update, delete on public.profile_top_friends to authenticated;

grant select on public.profile_top_guns to anon, authenticated;
grant insert, update, delete on public.profile_top_guns to authenticated;

drop policy if exists "Anyone can read top friends"
on public.profile_top_friends;

create policy "Anyone can read top friends"
on public.profile_top_friends
for select
using (true);

drop policy if exists "Users can manage their own top friends"
on public.profile_top_friends;

create policy "Users can manage their own top friends"
on public.profile_top_friends
for all
to authenticated
using (
  auth.uid() = profile_id
)
with check (
  auth.uid() = profile_id
);

drop policy if exists "Anyone can read top guns"
on public.profile_top_guns;

create policy "Anyone can read top guns"
on public.profile_top_guns
for select
using (true);

drop policy if exists "Users can manage their own top guns"
on public.profile_top_guns;

create policy "Users can manage their own top guns"
on public.profile_top_guns
for all
to authenticated
using (
  auth.uid() = profile_id
)
with check (
  auth.uid() = profile_id
);

create index if not exists profile_top_friends_profile_id_idx
on public.profile_top_friends(profile_id);

create index if not exists profile_top_friends_friend_profile_id_idx
on public.profile_top_friends(friend_profile_id);

create index if not exists profile_top_guns_profile_id_idx
on public.profile_top_guns(profile_id);