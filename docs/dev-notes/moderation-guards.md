# Moderation Guard Authority

Migration `151_fix_moderation_profile_permission_guards.sql` is the current
source of truth for moderation/profile permission guard behavior.

Earlier migrations introduced and patched related helpers and policies, but
future changes should treat migration 151 as the active baseline for:

- `is_moderator_or_above()`
- `is_admin_or_above()`
- `is_ceo()`
- `current_user_can_interact()`
- `assert_current_user_can_interact()`
- guarded insert policies for posts, comments, and friend requests
- guarded `toggle_post_vote()`
- `moderation_warn_user()`

Do not update older moderation guard migrations to change behavior. Add a new
forward migration instead.
