-- ------------------------------------------------------------
-- Stage 102: Tighten post_media RLS
-- Prevent direct Supabase clients from attaching media to posts
-- they do not own or inserting untrusted external media.
-- ------------------------------------------------------------

-- Keep grants if needed, but make RLS do the real enforcement.
-- These grants are not enough by themselves; policies below control access.

-- -----------------------------
-- SELECT: readable only when parent post is public and not deleted
-- -----------------------------
drop policy if exists "Users can insert media for their own posts" on public.post_media;
drop policy if exists "Anyone can read post media" on public.post_media;
drop policy if exists "Anyone can read visible post media" on public.post_media;

create policy "Anyone can read visible post media"
on public.post_media
for select
using (
  exists (
    select 1
    from public.posts p
    where p.id = post_media.post_id
      and p.is_deleted = false
      and p.visibility = 'public'
  )
);

-- -----------------------------
-- INSERT: authenticated users can only insert media for their own posts.
-- Also enforce provider/type/source shape at the RLS layer.
-- -----------------------------
drop policy if exists "Users can create their own post media" on public.post_media;
drop policy if exists "Post owners can create post media" on public.post_media;

create policy "Post owners can create post media"
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

-- -----------------------------
-- UPDATE: users can only update their own media AND it must remain
-- attached to their own post. This blocks changing post_id to someone else's post.
-- -----------------------------
drop policy if exists "Users can update their own post media" on public.post_media;
drop policy if exists "Post owners can update post media" on public.post_media;

create policy "Post owners can update post media"
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

-- -----------------------------
-- DELETE: users can only delete media from their own posts.
-- -----------------------------
drop policy if exists "Users can delete their own post media" on public.post_media;
drop policy if exists "Post owners can delete post media" on public.post_media;

create policy "Post owners can delete post media"
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
