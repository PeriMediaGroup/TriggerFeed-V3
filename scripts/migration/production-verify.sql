\pset pager off

create temp table verification_results (
  check_name text not null,
  actual_value text not null,
  expected_condition text not null,
  status text not null check (status in ('PASS', 'WARN', 'FAIL')),
  detail text not null
);

insert into verification_results
select 'auth_user_count', count(*)::text, '>= 1 after user import',
  case when count(*) >= 1 then 'PASS' else 'FAIL' end,
  'auth.users rows present'
from auth.users;

insert into verification_results
select 'profile_count', count(*)::text, '>= 1 after user import',
  case when count(*) >= 1 then 'PASS' else 'FAIL' end,
  'public.profiles rows present'
from public.profiles;

insert into verification_results
select 'auth_users_without_profiles', count(*)::text, '= 0',
  case when count(*) = 0 then 'PASS' else 'FAIL' end,
  'Every auth user should have a profile'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

insert into verification_results
select 'profiles_without_auth_users', count(*)::text, '= 0',
  case when count(*) = 0 then 'PASS' else 'FAIL' end,
  'Every profile should have a matching auth user'
from public.profiles p
left join auth.users u on u.id = p.id
where u.id is null;

insert into verification_results
select 'duplicate_normalized_usernames', count(*)::text, '= 0',
  case when count(*) = 0 then 'PASS' else 'FAIL' end,
  'username_lower should be unique when present'
from (
  select username_lower
  from public.profiles
  where username_lower is not null
  group by username_lower
  having count(*) > 1
) x;

insert into verification_results
select 'duplicate_normalized_emails', count(*)::text, '= 0 or documented accepted variance',
  case when count(*) = 0 then 'PASS' else 'FAIL' end,
  'Duplicate lower-case profile emails require explicit review'
from (
  select lower(trim(email)) as email_key
  from public.profiles
  where nullif(trim(email), '') is not null
  group by lower(trim(email))
  having count(*) > 1
) x;

insert into verification_results
select 'posts_with_missing_users', count(*)::text, '= 0',
  case when count(*) = 0 then 'PASS' else 'FAIL' end,
  'Posts must reference existing profiles'
from public.posts p
left join public.profiles pr on pr.id = p.user_id
where pr.id is null;

insert into verification_results
select 'media_with_missing_posts', count(*)::text, '= 0',
  case when count(*) = 0 then 'PASS' else 'FAIL' end,
  'Post media must reference existing posts'
from public.post_media pm
left join public.posts p on p.id = pm.post_id
where p.id is null;

insert into verification_results
select 'media_with_missing_users', count(*)::text, '= 0',
  case when count(*) = 0 then 'PASS' else 'FAIL' end,
  'Post media must reference existing profiles'
from public.post_media pm
left join public.profiles p on p.id = pm.user_id
where p.id is null;

insert into verification_results
select 'comments_with_missing_posts', count(*)::text, '= 0',
  case when count(*) = 0 then 'PASS' else 'FAIL' end,
  'Comments must reference existing posts'
from public.comments c
left join public.posts p on p.id = c.post_id
where p.id is null;

insert into verification_results
select 'comments_with_missing_users', count(*)::text, '= 0',
  case when count(*) = 0 then 'PASS' else 'FAIL' end,
  'Comments must reference existing profiles'
from public.comments c
left join public.profiles p on p.id = c.user_id
where p.id is null;

insert into verification_results
select 'replies_with_missing_parents', count(*)::text, '= 0',
  case when count(*) = 0 then 'PASS' else 'FAIL' end,
  'Replies must reference existing parent comments'
from public.comments c
left join public.comments parent on parent.id = c.parent_comment_id
where c.parent_comment_id is not null
  and parent.id is null;

insert into verification_results
select 'replies_parent_belongs_to_another_post', count(*)::text, '= 0',
  case when count(*) = 0 then 'PASS' else 'FAIL' end,
  'Reply parent must belong to the same post'
from public.comments c
join public.comments parent on parent.id = c.parent_comment_id
where c.post_id <> parent.post_id;

insert into verification_results
select 'friendships_with_missing_users', count(*)::text, '= 0',
  case when count(*) = 0 then 'PASS' else 'FAIL' end,
  'Friend rows must reference existing profiles'
from public.friends f
left join public.profiles requester on requester.id = f.requester_id
left join public.profiles addressee on addressee.id = f.addressee_id
where requester.id is null or addressee.id is null;

insert into verification_results
select 'self_friend_relationships', count(*)::text, '= 0',
  case when count(*) = 0 then 'PASS' else 'FAIL' end,
  'Requester and addressee must differ'
from public.friends
where requester_id = addressee_id;

insert into verification_results
select 'duplicate_normalized_friend_pairs', count(*)::text, '= 0',
  case when count(*) = 0 then 'PASS' else 'FAIL' end,
  'Unordered friend pairs should be unique'
from (
  select least(requester_id, addressee_id), greatest(requester_id, addressee_id)
  from public.friends
  group by least(requester_id, addressee_id), greatest(requester_id, addressee_id)
  having count(*) > 1
) x;

insert into verification_results
select 'votes_with_missing_users', count(*)::text, '= 0',
  case when count(*) = 0 then 'PASS' else 'FAIL' end,
  'Post votes must reference existing profiles'
from public.post_votes pv
left join public.profiles p on p.id = pv.user_id
where p.id is null;

insert into verification_results
select 'votes_with_missing_posts', count(*)::text, '= 0',
  case when count(*) = 0 then 'PASS' else 'FAIL' end,
  'Post votes must reference existing posts'
from public.post_votes pv
left join public.posts p on p.id = pv.post_id
where p.id is null;

insert into verification_results
select 'duplicate_user_post_votes', count(*)::text, '= 0',
  case when count(*) = 0 then 'PASS' else 'FAIL' end,
  'A user should have at most one vote per post'
from (
  select user_id, post_id
  from public.post_votes
  group by user_id, post_id
  having count(*) > 1
) x;

insert into verification_results
select 'invalid_vote_values', count(*)::text, '= 0',
  case when count(*) = 0 then 'PASS' else 'FAIL' end,
  'vote_type must stay within supported values'
from public.post_votes
where vote_type not in ('upvote', 'downvote');

insert into verification_results
select 'unexpected_legacy_notifications', count(*)::text, '= 0 unless intentionally migrated',
  case when count(*) = 0 then 'PASS' else 'WARN' end,
  'Legacy notification migration is not currently expected'
from public.notifications
where metadata ? 'legacy_id'
   or type ilike 'legacy%';

insert into verification_results
select 'legacy_private_messages_table', coalesce(to_regclass('public.private_messages')::text, 'absent'), 'absent unless intentionally migrated',
  case when to_regclass('public.private_messages') is null then 'PASS' else 'WARN' end,
  'Private messages are not part of the expected V3 import';

insert into verification_results
select 'legacy_poll_data_present', count(*)::text, 'WARN if legacy-imported poll rows exist',
  case when count(*) = 0 then 'PASS' else 'WARN' end,
  'Poll data should be explicitly reviewed if imported from legacy'
from public.polls
where post_id is not null;

insert into verification_results
select 'staging_table_row_counts', coalesce(string_agg(table_name || '=' || row_estimate, '; ' order by table_name), 'none'), 'review any staging tables before cleanup',
  case when count(*) = 0 then 'PASS' else 'WARN' end,
  'Staging tables may be retained until post-cutover approval'
from (
  select
    c.relname as table_name,
    greatest(c.reltuples::bigint, 0)::text as row_estimate
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname like 'migration_%'
) x;

insert into verification_results
select 'required_tables', count(*)::text, '= 15 required tables present',
  case when count(*) = 15 then 'PASS' else 'FAIL' end,
  'Required public tables: profiles, posts, comments, post_media, post_votes, friends, notifications, notification_settings, polls, poll_options, poll_responses, post_reports, abuse_reports, moderation_actions, moderation_events'
from unnest(array['profiles','posts','comments','post_media','post_votes','friends','notifications','notification_settings','polls','poll_options','poll_responses','post_reports','abuse_reports','moderation_actions','moderation_events']) t(name)
where to_regclass('public.' || quote_ident(name)) is not null;

insert into verification_results
select 'required_rpcs', count(*)::text, '= 14 required functions present',
  case when count(*) = 14 then 'PASS' else 'FAIL' end,
  'Required app/admin RPCs are present'
from unnest(array[
  'get_my_profile_auth_status','get_public_profile','get_public_profile_cards','create_post_transactional',
  'update_post_transactional','soft_delete_post','soft_delete_comment','toggle_post_vote','get_post_vote_counts',
  'get_current_moderation_actor_role','get_admin_nav_counts','search_admin_users','change_user_role','get_admin_activity_overview'
]) f(name)
where exists (
  select 1
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = f.name
);

insert into verification_results
select 'required_triggers', count(*)::text, '>= 6 required triggers present',
  case when count(*) >= 6 then 'PASS' else 'FAIL' end,
  'Core update/auth/profile triggers are installed'
from pg_trigger t
where not t.tgisinternal
  and t.tgname in (
    'on_auth_user_created',
    'set_profiles_username_lower_trigger',
    'set_profiles_updated_at',
    'set_posts_updated_at',
    'set_comments_updated_at',
    'prevent_invalid_comment_reply_trigger',
    'set_post_votes_updated_at',
    'set_friends_updated_at'
  );

insert into verification_results
select 'required_indexes_and_constraints', count(*)::text, '>= 8 required index/constraint names present',
  case when count(*) >= 8 then 'PASS' else 'FAIL' end,
  'Key uniqueness and lookup structures are present'
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'profiles_username_lower_key',
    'profiles_username_lower_idx',
    'post_votes_unique_user_post',
    'friends_unique_pair',
    'friends_unique_profile_pair',
    'post_reports_unique_post_reporter',
    'posts_public_feed_idx',
    'post_media_post_sort_idx',
    'comments_post_id_parent_comment_id_idx'
  );

insert into verification_results
select 'rls_enabled_expected_tables', count(*)::text, '= 15 required tables have RLS enabled',
  case when count(*) = 15 then 'PASS' else 'FAIL' end,
  'Expected public tables should have row level security enabled'
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('profiles','posts','comments','post_media','post_votes','friends','notifications','notification_settings','polls','poll_options','poll_responses','post_reports','abuse_reports','moderation_actions','moderation_events')
  and c.relrowsecurity;

insert into verification_results
select 'expected_policies', count(*)::text, '>= 20 policies present on expected tables',
  case when count(*) >= 20 then 'PASS' else 'FAIL' end,
  'RLS policies exist on expected public tables'
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles','posts','comments','post_media','post_votes','friends','notifications','notification_settings','polls','poll_options','poll_responses','post_reports','abuse_reports','moderation_actions','moderation_events');

insert into verification_results
select 'expected_admin_moderation_functions', count(*)::text, '= 10 expected moderation/admin functions present',
  case when count(*) = 10 then 'PASS' else 'FAIL' end,
  'Moderation/admin function surface is present'
from unnest(array[
  'is_moderator_or_above','is_admin_or_above','is_ceo','get_current_moderation_actor_role',
  'get_admin_nav_counts','moderation_warn_user','moderation_mute_user','moderation_ban_user',
  'moderation_remove_post','change_user_role'
]) f(name)
where exists (
  select 1
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = f.name
);

insert into verification_results
select 'migration_version_state', coalesce(max(version), 'none'), 'latest applied migration should match reviewed release',
  case when max(version) is null then 'WARN' else 'PASS' end,
  'Review supabase_migrations.schema_migrations before go/no-go'
from supabase_migrations.schema_migrations;

select check_name, actual_value, expected_condition, status, detail
from verification_results
order by
  case status when 'FAIL' then 1 when 'WARN' then 2 else 3 end,
  check_name;
