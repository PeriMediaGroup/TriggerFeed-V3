-- =========================================================
-- 030: Post Media, Cloudinary Uploads, and GIPHY GIFs
-- =========================================================

begin;

create table if not exists public.post_media (
  id uuid primary key default gen_random_uuid(),

  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,

  media_type text not null default 'image',
  provider text not null default 'cloudinary',
  source text,

  cloudinary_url text,
  cloudinary_secure_url text,
  cloudinary_public_id text,

  external_id text,
  external_url text,
  thumbnail_url text,
  title text,

  original_filename text,
  mime_type text,
  file_size_bytes integer,

  width integer,
  height integer,
  format text,

  alt_text text,
  sort_order integer not null default 0,
  display_order integer not null default 0,

  created_at timestamptz not null default now(),

  constraint post_media_media_type_check
    check (media_type in ('image', 'video', 'gif')),

  constraint post_media_provider_check
    check (provider in ('cloudinary', 'giphy')),

  constraint post_media_sort_order_check
    check (sort_order >= 0),

  constraint post_media_display_order_check
    check (display_order >= 0),

  constraint post_media_file_size_check
    check (file_size_bytes is null or file_size_bytes >= 0),

  constraint post_media_dimensions_check
    check (
      (width is null or width > 0)
      and
      (height is null or height > 0)
    ),

  constraint post_media_has_valid_media_source
    check (
      (
        provider = 'cloudinary'
        and media_type in ('image', 'video')
        and cloudinary_url is not null
        and cloudinary_public_id is not null
      )
      or
      (
        provider = 'giphy'
        and media_type = 'gif'
        and external_url is not null
      )
    )
);

create index if not exists post_media_post_id_idx
on public.post_media(post_id);

create index if not exists post_media_user_id_idx
on public.post_media(user_id);

create index if not exists post_media_post_sort_idx
on public.post_media(post_id, sort_order);

create index if not exists post_media_provider_idx
on public.post_media(provider);

create index if not exists post_media_media_type_idx
on public.post_media(media_type);

create index if not exists post_media_external_id_idx
on public.post_media(external_id);

alter table public.post_media enable row level security;

revoke all on public.post_media from anon;
revoke all on public.post_media from authenticated;

grant select on public.post_media to anon, authenticated;
grant insert, update, delete on public.post_media to authenticated;

create policy "post_media_select_visible_public_post"
on public.post_media
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.posts p
    where p.id = post_media.post_id
      and p.is_deleted = false
      and p.visibility = 'public'
  )
);

create policy "post_media_insert_own_post_trusted_source"
on public.post_media
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.posts p
    where p.id = post_media.post_id
      and p.user_id = auth.uid()
      and p.is_deleted = false
      and p.visibility = 'public'
  )
  and (
    (
      provider = 'cloudinary'
      and media_type in ('image', 'video')
      and cloudinary_url is not null
      and cloudinary_public_id is not null
      -- TODO: If staging/prod use a different Cloudinary cloud name, replace
      -- this with an environment-safe DB helper or environment-specific migration.
      and cloudinary_public_id like ('triggerfeed/posts/' || auth.uid()::text || '/' || post_id::text || '/%')
      and cloudinary_url like 'https://res.cloudinary.com/triggerfeed/%'
      and (
        cloudinary_secure_url is null
        or cloudinary_secure_url like 'https://res.cloudinary.com/triggerfeed/%'
      )
    )
    or
    (
      provider = 'giphy'
      and media_type = 'gif'
      and external_url is not null
      and (
        external_url like 'https://media.giphy.com/%'
        or external_url like 'https://media%.giphy.com/%'
        or external_url like 'https://i.giphy.com/%'
      )
      and (
        thumbnail_url is null
        or thumbnail_url like 'https://media.giphy.com/%'
        or thumbnail_url like 'https://media%.giphy.com/%'
        or thumbnail_url like 'https://i.giphy.com/%'
      )
    )
  )
);

create policy "post_media_update_own_post_trusted_source"
on public.post_media
for update
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.posts p
    where p.id = post_media.post_id
      and p.user_id = auth.uid()
      and p.is_deleted = false
      and p.visibility = 'public'
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.posts p
    where p.id = post_media.post_id
      and p.user_id = auth.uid()
      and p.is_deleted = false
      and p.visibility = 'public'
  )
  and (
    (
      provider = 'cloudinary'
      and media_type in ('image', 'video')
      and cloudinary_url is not null
      and cloudinary_public_id is not null
      and cloudinary_public_id like ('triggerfeed/posts/' || auth.uid()::text || '/' || post_id::text || '/%')
      and cloudinary_url like 'https://res.cloudinary.com/triggerfeed/%'
      and (
        cloudinary_secure_url is null
        or cloudinary_secure_url like 'https://res.cloudinary.com/triggerfeed/%'
      )
    )
    or
    (
      provider = 'giphy'
      and media_type = 'gif'
      and external_url is not null
      and (
        external_url like 'https://media.giphy.com/%'
        or external_url like 'https://media%.giphy.com/%'
        or external_url like 'https://i.giphy.com/%'
      )
      and (
        thumbnail_url is null
        or thumbnail_url like 'https://media.giphy.com/%'
        or thumbnail_url like 'https://media%.giphy.com/%'
        or thumbnail_url like 'https://i.giphy.com/%'
      )
    )
  )
);

create policy "post_media_delete_own_post"
on public.post_media
for delete
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.posts p
    where p.id = post_media.post_id
      and p.user_id = auth.uid()
      and p.is_deleted = false
  )
);

commit;
