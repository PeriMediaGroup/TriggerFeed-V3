-- =========================================================
-- Revoke direct RPC access from internal helper/trigger funcs
-- =========================================================

revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;

revoke execute on function public.auto_friend_ceo_profile() from public;
revoke execute on function public.auto_friend_ceo_profile() from anon;
revoke execute on function public.auto_friend_ceo_profile() from authenticated;

revoke execute on function public.enforce_ceo_sticky_posts() from public;
revoke execute on function public.enforce_ceo_sticky_posts() from anon;
revoke execute on function public.enforce_ceo_sticky_posts() from authenticated;

revoke execute on function public.prevent_invalid_comment_reply() from public;
revoke execute on function public.prevent_invalid_comment_reply() from anon;
revoke execute on function public.prevent_invalid_comment_reply() from authenticated;