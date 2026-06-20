-- ============================================================
-- Allow legacy/public post visibility values for V3
-- ============================================================

alter table public.posts
drop constraint if exists posts_visibility_public_only_check;

alter table public.posts
drop constraint if exists posts_visibility_check;

alter table public.posts
add constraint posts_visibility_check
check (visibility in ('public', 'friends', 'private'));