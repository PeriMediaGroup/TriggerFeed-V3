-- =========================================================
-- Harden helper/trigger function execute grants
-- These functions are used internally by triggers or DB logic
-- and should not be callable directly through /rest/v1/rpc.
-- =========================================================

alter function public.set_post_reports_updated_at()
set search_path = public, pg_temp;

revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.auto_friend_ceo_profile() from anon, authenticated;
revoke execute on function public.enforce_ceo_sticky_posts() from anon, authenticated;
revoke execute on function public.prevent_invalid_comment_reply() from anon, authenticated;