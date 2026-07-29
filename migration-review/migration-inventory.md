# Migration Inventory

Scope: web repository only (`C:\Users\petes\PeriMediaGroup\TriggerFeed_V3\web`). This is an audit document; no migrations or database objects were modified.

## Supabase config

- `supabase/config.toml`
- Project id: `triggerfeed-v3`
- Local DB major version: 17
- Migrations enabled: true
- Seed enabled: false
- Seed path still references `./snippets/set up test accounts.sql`; because seed is disabled, it should not run during normal reset/push flows. Keep disabled for production.
- API exposed schemas: `public`, `graphql_public`
- Database-related Edge Function configured: `report-abuse` with JWT verification enabled.

## Migration files

| Order | File | Notes |
| --- | --- | --- |
| 010 | `010_auth_profiles.sql` | Auth profile schema, profile RPCs, public profile card helpers, signup trigger. |
| 020 | `020_posts_comments.sql` | Posts/comments schema, soft-delete helpers, reply constraints. |
| 030 | `030_post_media.sql` | Post media schema and related policies. |
| 040 | `040_post_votes.sql` | Post votes, vote counts, vote RPCs. |
| 050 | `050_friends.sql` | Friend edges, friend count, accepted-friend helper. |
| 060 | `060_notifications.sql` | Notification schema and notification creation helpers. |
| 070 | `070_profile_showcase.sql` | Profile showcase fields/features. |
| 080 | `080_polls.sql` | Poll schema. Legacy poll import is not currently covered by migration scripts. |
| 090 | `090_create_post_reports.sql` | Post report schema. |
| 100 | `100_auto_friend_ceo.sql` | CEO auto-friend trigger/helper. |
| 110 | `110_feed_post_ranks.sql` | Feed rank helper. |
| 111 | `111_ceo_sticky_posts.sql` | CEO sticky post support. |
| 112 | `112_restore_ceo_sticky_posts_trigger.sql` | Restores sticky post trigger behavior. |
| 120 | `120_moderation_actions.sql` | Moderation role helpers, actions, account/post moderation RPCs. |
| 130 | `130_moderation_warning_notifications.sql` | Warning notification integration. |
| 140 | `140_admin_user_search.sql` | Admin user search RPC. |
| 150 | `150_fix_moderation_account_status_guards.sql` | Account status guard fixes. |
| 151 | `151_fix_moderation_profile_permission_guards.sql` | Profile permission guard fixes. |
| 160 | `160_friend_suggestions.sql` | Friend suggestion RPC. |
| 161 | `161_cleanup_sticky_post_trigger.sql` | Sticky trigger cleanup. |
| 162 | `162_exclude_ceo_from_friend_suggestion_mutuals.sql` | Friend suggestion refinement. |
| 163 | `163_rank_system.sql` | Rank system tables/helpers. |
| 164 | `164_lock_down_user_rank_thresholds.sql` | Rank threshold hardening. |
| 165 | `165_beta_hardening.sql` | Broad beta hardening, create/update post transactional RPCs, poll helpers. |
| 166 | `166_privacy_rls_audit.sql` | Privacy/RLS follow-up. |
| 167 | `167_soft_delete_my_account.sql` | Self-service account soft delete. |
| 168 | `168_moderation_events_account_notices.sql` | Moderation events and account notices. |
| 169 | `169_warning_notification_context.sql` | Warning notification context. |
| 170 | `170_warning_notification_post_link_metadata.sql` | Warning notification post metadata. |
| 171 | `171_warning_notification_derive_report_post.sql` | Derive report post in warning flow. |
| 172 | `172_moderation_report_permissions_restore.sql` | Restores moderation report permission paths. |
| 173 | `173_allow_hyphenated_usernames.sql` | Username validation change. |
| 174 | `174_abuse_reports.sql` | Abuse report schema/helper. |
| 175 | `175_public_birthday_display.sql` | Public birthday display behavior. |
| 176 | `176_restrict_admin_user_search.sql` | Restricts admin user search to admin/CEO. |
| 177 | `177_harden_post_vote_counts_access.sql` | Vote-count access hardening. |
| 178 | `178_allow_post_visibility_levels.sql` | Post visibility extension. |
| 179 | `179_search_friend_candidates.sql` | Friend candidate search RPC. |
| 180 | `180_top_gun_images.sql` | Image metadata/feature support. |
| 181 | `181_admin_nav_counts.sql` | Admin nav counts RPC. See lint finding for optional moderation review relation. |
| 182 | `182_tiered_moderation_role_changes.sql` | Tiered moderation roles, role-change RPCs, admin nav count replacement. |
| 183 | `183_user_activity_overview.sql` | User activity overview RPCs. |
| 20260625140955 | `20260625140955_harden_helper_function_execute_grants.sql` | Helper execute-grant hardening. |
| 20260625141224 | `20260625141224_revoke_public_execute_on_helper_functions.sql` | Additional execute revokes for helper functions. |
| docs | `README.md` | Migration notes. |

## Ordering observations

- The chain is mostly numeric through `183_*`, followed by two timestamped hardening migrations. Lexical order will run the timestamped files after `183_*` in a fresh reset.
- No duplicate migration filenames were found in this audit.
- The mixed numeric/timestamp naming is operationally acceptable but should be frozen before production so no new migration is accidentally inserted earlier in the chain.

## Security-definer and execute-grant observations

- The reviewed migrations consistently use `security definer` plus `set search_path = public` or a narrower explicit search path on many RPCs.
- Later hardening migrations revoke public/anon/authenticated execute from trigger/helper functions that should not be directly callable.
- Before cutover, verify every `SECURITY DEFINER` function has an explicit auth/role gate appropriate to its use, especially moderation/admin/account-management RPCs.
