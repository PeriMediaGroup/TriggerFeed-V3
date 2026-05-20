-- =========================================================
-- 070: Profile Showcase
-- Top friends and top guns/profile showcase tables.
-- =========================================================

begin;

create table if not exists public.profile_top_friends (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_user_id uuid not null references public.profiles(id) on delete cascade,

  display_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profile_top_friends_no_self
    check (user_id <> friend_user_id),

  constraint profile_top_friends_display_order_check
    check (display_order >= 0),

  constraint profile_top_friends_unique_friend
    unique (user_id, friend_user_id),

  constraint profile_top_friends_unique_order
    unique (user_id, display_order)
);

create table if not exists public.profile_top_guns (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references public.profiles(id) on delete cascade,

  name text not null,
  description text,
  image_cloudinary_url text,
  image_cloudinary_public_id text,

  display_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profile_top_guns_name_length_check
    check (char_length(trim(name)) between 1 and 120),

  constraint profile_top_guns_description_length_check
    check (description is null or char_length(description) <= 500),

  constraint profile_top_guns_display_order_check
    check (display_order >= 0),

  constraint profile_top_guns_unique_order
    unique (user_id, display_order)
);

create or replace function public.set_profile_showcase_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profile_top_friends_updated_at on public.profile_top_friends;
create trigger set_profile_top_friends_updated_at
before update on public.profile_top_friends
for each row
execute function public.set_profile_showcase_updated_at();

drop trigger if exists set_profile_top_guns_updated_at on public.profile_top_guns;
create trigger set_profile_top_guns_updated_at
before update on public.profile_top_guns
for each row
execute function public.set_profile_showcase_updated_at();

create index if not exists profile_top_friends_user_id_idx
on public.profile_top_friends(user_id);

create index if not exists profile_top_friends_friend_user_id_idx
on public.profile_top_friends(friend_user_id);

create index if not exists profile_top_friends_user_id_display_order_idx
on public.profile_top_friends(user_id, display_order);

create index if not exists profile_top_guns_user_id_idx
on public.profile_top_guns(user_id);

create index if not exists profile_top_guns_user_id_display_order_idx
on public.profile_top_guns(user_id, display_order);

alter table public.profile_top_friends enable row level security;
alter table public.profile_top_guns enable row level security;

revoke all on public.profile_top_friends from anon;
revoke all on public.profile_top_friends from authenticated;
revoke all on public.profile_top_guns from anon;
revoke all on public.profile_top_guns from authenticated;

grant select on public.profile_top_friends to anon, authenticated;
grant insert, update, delete on public.profile_top_friends to authenticated;

grant select on public.profile_top_guns to anon, authenticated;
grant insert, update, delete on public.profile_top_guns to authenticated;

create policy "profile_top_friends_select_visible_profiles"
on public.profile_top_friends
for select
to anon, authenticated
using (
  public.is_profile_visible(user_id)
);

create policy "profile_top_friends_manage_own"
on public.profile_top_friends
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "profile_top_guns_select_visible_profiles"
on public.profile_top_guns
for select
to anon, authenticated
using (
  public.is_profile_visible(user_id)
);

create policy "profile_top_guns_manage_own"
on public.profile_top_guns
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

commit;
