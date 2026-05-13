-- =========================================================
-- Stage 4: Post Media Foundation
-- Supports post images now, future media types later.
-- =========================================================

create table if not exists public.post_media (
  id uuid primary key default gen_random_uuid(),

  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,

  media_type text not null default 'image',
  provider text not null default 'cloudinary',

  cloudinary_url text not null,
  cloudinary_secure_url text,
  cloudinary_public_id text not null,

  original_filename text,
  mime_type text,
  file_size_bytes integer,

  width integer,
  height integer,
  format text,

  alt_text text,
  sort_order integer not null default 0,

  created_at timestamptz not null default now(),

  constraint post_media_media_type_check
    check (media_type in ('image', 'video', 'animated_image', 'external_gif')),

  constraint post_media_provider_check
    check (provider in ('cloudinary', 'giphy', 'tenor', 'youtube', 'external')),

  constraint post_media_sort_order_check
    check (sort_order >= 0),

  constraint post_media_file_size_check
    check (file_size_bytes is null or file_size_bytes >= 0),

  constraint post_media_dimensions_check
    check (
      (width is null or width > 0)
      and
      (height is null or height > 0)
    )
);

-- Explicit constraints so Supabase/PostgREST can detect relationships.
alter table public.post_media
drop constraint if exists post_media_post_id_fkey;

alter table public.post_media
add constraint post_media_post_id_fkey
foreign key (post_id)
references public.posts(id)
on delete cascade;

alter table public.post_media
drop constraint if exists post_media_user_id_fkey;

alter table public.post_media
add constraint post_media_user_id_fkey
foreign key (user_id)
references public.profiles(id)
on delete cascade;

create index if not exists post_media_post_id_idx
  on public.post_media(post_id);

create index if not exists post_media_user_id_idx
  on public.post_media(user_id);

create index if not exists post_media_post_sort_idx
  on public.post_media(post_id, sort_order);

alter table public.post_media enable row level security;

drop policy if exists "Anyone can read post media"
on public.post_media;

create policy "Anyone can read post media"
on public.post_media
for select
using (
  exists (
    select 1
    from public.posts
    where posts.id = post_media.post_id
      and posts.is_deleted = false
      and posts.visibility = 'public'
  )
);

drop policy if exists "Users can insert media for their own posts"
on public.post_media;

create policy "Users can insert media for their own posts"
on public.post_media
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.posts
    where posts.id = post_media.post_id
      and posts.user_id = auth.uid()
      and posts.is_deleted = false
  )
);

drop policy if exists "Users can update their own post media"
on public.post_media;

create policy "Users can update their own post media"
on public.post_media
for update
to authenticated
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);

drop policy if exists "Users can delete their own post media"
on public.post_media;

create policy "Users can delete their own post media"
on public.post_media
for delete
to authenticated
using (
  auth.uid() = user_id
);

grant select on public.post_media to anon;
grant select, insert, update, delete on public.post_media to authenticated;