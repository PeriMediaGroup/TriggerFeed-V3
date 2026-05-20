-- ------------------------------------------------------------
-- Stage 100: GIPHY support for post media
-- Allows post_media rows to represent either uploaded Cloudinary
-- media or externally hosted GIPHY media.
-- ------------------------------------------------------------

-- Add external media fields.
alter table public.post_media
add column if not exists source text,
add column if not exists external_id text,
add column if not exists external_url text,
add column if not exists thumbnail_url text,
add column if not exists title text,
add column if not exists display_order integer not null default 0;

-- Make Cloudinary-specific fields nullable so external media can exist.
alter table public.post_media
alter column cloudinary_url drop not null;

alter table public.post_media
alter column cloudinary_secure_url drop not null;

alter table public.post_media
alter column cloudinary_public_id drop not null;

-- Replace old media_type constraint so GIFs are allowed.
alter table public.post_media
drop constraint if exists post_media_media_type_check;

alter table public.post_media
add constraint post_media_media_type_check
check (media_type in ('image', 'video', 'gif'));

-- Replace / add media source validity constraint.
alter table public.post_media
drop constraint if exists post_media_has_valid_media_source;

alter table public.post_media
add constraint post_media_has_valid_media_source
check (
  (
    provider = 'cloudinary'
    and media_type in ('image', 'video')
    and cloudinary_url is not null
  )
  or
  (
    provider = 'giphy'
    and media_type = 'gif'
    and external_url is not null
  )
);

-- Helpful indexes for external media lookups.
create index if not exists post_media_provider_idx
on public.post_media(provider);

create index if not exists post_media_media_type_idx
on public.post_media(media_type);

create index if not exists post_media_external_id_idx
on public.post_media(external_id);