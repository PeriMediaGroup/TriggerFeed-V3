-- =========================================================
-- 161: Cleanup Sticky Post Trigger
-- =========================================================

begin;

-- Migration 112 is the current sticky-post enforcement path. It restores
-- public.enforce_ceo_sticky_posts() and enforce_ceo_sticky_posts_trigger.
-- Drop the older migration-111 trigger/function so posts has one active
-- sticky enforcement trigger.
drop trigger if exists enforce_ceo_sticky_post_fields_trigger
on public.posts;

drop function if exists public.enforce_ceo_sticky_post_fields();

commit;
