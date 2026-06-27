


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."are_users_accepted_friends"("p_user_id" "uuid", "p_friend_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select auth.uid() is not null
    and auth.uid() in (p_user_id, p_friend_user_id)
    and exists (
      select 1
      from public.friends f
      where f.status = 'accepted'
        and (
          (f.requester_id = p_user_id and f.addressee_id = p_friend_user_id)
          or
          (f.requester_id = p_friend_user_id and f.addressee_id = p_user_id)
        )
    );
$$;


ALTER FUNCTION "public"."are_users_accepted_friends"("p_user_id" "uuid", "p_friend_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assert_current_user_can_interact"() RETURNS "void"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_profile record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select
    coalesce(p.is_deleted, false) as is_deleted,
    coalesce(p.is_banned, false) as is_banned,
    coalesce(p.is_muted, false) as is_muted
  into v_profile
  from public.profiles p
  where p.id = auth.uid()
  limit 1;

  if v_profile is null then
    raise exception 'Account profile not found';
  end if;

  if v_profile.is_deleted then
    raise exception 'This account is not active';
  end if;

  if v_profile.is_banned then
    raise exception 'This account is banned from creating interactions';
  end if;

  if v_profile.is_muted then
    raise exception 'This account is muted from creating interactions';
  end if;
end;
$$;


ALTER FUNCTION "public"."assert_current_user_can_interact"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_friend_ceo_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  ceo_profile_id uuid;
begin
  select id
  into ceo_profile_id
  from public.profiles
  where role = 'ceo'
    and coalesce(is_deleted, false) = false
  order by created_at asc
  limit 1;

  -- No CEO exists yet. Do nothing.
  if ceo_profile_id is null then
    return new;
  end if;

  -- Do not friend the CEO to themselves.
  if ceo_profile_id = new.id then
    return new;
  end if;

  insert into public.friends (
    id,
    requester_id,
    addressee_id,
    status,
    created_at,
    updated_at
  )
  values (
    gen_random_uuid(),
    new.id,
    ceo_profile_id,
    'accepted',
    now(),
    now()
  )
  on conflict do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."auto_friend_ceo_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."change_user_role"("p_target_user_id" "uuid", "p_new_role" "text", "p_reason" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_target record;
  v_new_role text := lower(trim(coalesce(p_new_role, '')));
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_action_id uuid;
begin
  if not public.is_ceo() then
    raise exception 'CEO permission required';
  end if;

  if v_new_role not in ('user', 'moderator', 'admin') then
    raise exception 'Invalid target role';
  end if;

  if v_reason is null then
    raise exception 'Role change reason is required';
  end if;

  if p_target_user_id = auth.uid() then
    raise exception 'You cannot change your own role';
  end if;

  select p.id, p.role
  into v_target
  from public.profiles p
  where p.id = p_target_user_id
    and coalesce(p.is_deleted, false) = false
  limit 1;

  if v_target.id is null then
    raise exception 'Target user not found';
  end if;

  if v_target.role = 'ceo' then
    raise exception 'CEO accounts cannot be changed by this action';
  end if;

  if v_target.role = v_new_role then
    raise exception 'Target user already has that role';
  end if;

  update public.profiles
  set role = v_new_role,
      updated_at = now()
  where id = p_target_user_id;

  insert into public.moderation_actions (
    target_user_id,
    actor_user_id,
    action_type,
    reason,
    message,
    metadata
  )
  values (
    p_target_user_id,
    auth.uid(),
    'role_changed',
    v_reason,
    'Role changed from ' || coalesce(v_target.role, 'user') || ' to ' || v_new_role,
    jsonb_build_object(
      'old_role', coalesce(v_target.role, 'user'),
      'new_role', v_new_role
    )
  )
  returning id into v_action_id;

  return v_action_id;
end;
$$;


ALTER FUNCTION "public"."change_user_role"("p_target_user_id" "uuid", "p_new_role" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_comment_notification"("p_post_id" "uuid", "p_comment_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor_id uuid := auth.uid();
  v_post_owner_id uuid;
  v_notification_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  select p.user_id
  into v_post_owner_id
  from public.posts p
  where p.id = p_post_id
    and coalesce(p.is_deleted, false) = false
    and p.visibility = 'public';

  if v_post_owner_id is null then
    raise exception 'Post not found';
  end if;

  if v_post_owner_id = v_actor_id then
    return null;
  end if;

  if not exists (
    select 1
    from public.comments c
    where c.id = p_comment_id
      and c.post_id = p_post_id
      and c.user_id = v_actor_id
      and coalesce(c.is_deleted, false) = false
  ) then
    raise exception 'Comment notification denied: actor does not own comment';
  end if;

  if not public.should_create_notification(v_post_owner_id, 'comment') then
    return null;
  end if;

  insert into public.notifications (
    user_id,
    actor_id,
    type,
    post_id,
    comment_id,
    title,
    body,
    metadata
  )
  values (
    v_post_owner_id,
    v_actor_id,
    'comment',
    p_post_id,
    p_comment_id,
    'New comment',
    'commented on your post',
    jsonb_build_object('source', 'comment')
  )
  on conflict do nothing
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;


ALTER FUNCTION "public"."create_comment_notification"("p_post_id" "uuid", "p_comment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_friend_accepted_notification"("p_friend_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor_id uuid := auth.uid();
  v_requester_id uuid;
  v_recipient_id uuid;
  v_status text;
  v_notification_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  select f.requester_id, f.addressee_id, f.status
  into v_requester_id, v_recipient_id, v_status
  from public.friends f
  where f.id = p_friend_id;

  if v_requester_id is null then
    raise exception 'Friend row not found';
  end if;

  if v_recipient_id <> v_actor_id then
    raise exception 'Friend accepted notification denied: actor is not addressee';
  end if;

  if v_status <> 'accepted' then
    raise exception 'Friend accepted notification denied: friendship is not accepted';
  end if;

  if v_requester_id = v_actor_id then
    return null;
  end if;

  if not public.should_create_notification(v_requester_id, 'friend_accepted') then
    return null;
  end if;

  insert into public.notifications (
    user_id,
    actor_id,
    type,
    friend_id,
    title,
    body,
    metadata
  )
  values (
    v_requester_id,
    v_actor_id,
    'friend_accepted',
    p_friend_id,
    'Friend request accepted',
    'accepted your friend request',
    jsonb_build_object('source', 'friend_accepted')
  )
  on conflict do nothing
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;


ALTER FUNCTION "public"."create_friend_accepted_notification"("p_friend_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_friend_request_notification"("p_friend_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor_id uuid := auth.uid();
  v_requester_id uuid;
  v_recipient_id uuid;
  v_notification_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  select f.requester_id, f.addressee_id
  into v_requester_id, v_recipient_id
  from public.friends f
  where f.id = p_friend_id
    and f.status = 'pending';

  if v_requester_id is null then
    raise exception 'Friend request not found';
  end if;

  if v_requester_id <> v_actor_id then
    raise exception 'Friend request notification denied: actor is not requester';
  end if;

  if v_recipient_id = v_actor_id then
    return null;
  end if;

  if not public.should_create_notification(v_recipient_id, 'friend_request') then
    return null;
  end if;

  insert into public.notifications (
    user_id,
    actor_id,
    type,
    friend_id,
    title,
    body,
    metadata
  )
  values (
    v_recipient_id,
    v_actor_id,
    'friend_request',
    p_friend_id,
    'New friend request',
    'sent you a friend request',
    jsonb_build_object('source', 'friend_request')
  )
  on conflict do nothing
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;


ALTER FUNCTION "public"."create_friend_request_notification"("p_friend_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_mention_notification"("p_user_id" "uuid", "p_post_id" "uuid", "p_comment_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor_id uuid := auth.uid();
  v_notification_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_user_id is null then
    raise exception 'Missing notification user_id';
  end if;

  if p_user_id = v_actor_id then
    return null;
  end if;

  if p_comment_id is null then
    if not exists (
      select 1
      from public.posts p
      where p.id = p_post_id
        and p.user_id = v_actor_id
        and coalesce(p.is_deleted, false) = false
        and p.visibility = 'public'
    ) then
      raise exception 'Mention notification denied: actor does not own post';
    end if;
  else
    if not exists (
      select 1
      from public.comments c
      where c.id = p_comment_id
        and c.post_id = p_post_id
        and c.user_id = v_actor_id
        and coalesce(c.is_deleted, false) = false
    ) then
      raise exception 'Mention notification denied: actor does not own comment';
    end if;
  end if;

  if not public.should_create_notification(p_user_id, 'mention') then
    return null;
  end if;

  insert into public.notifications (
    user_id,
    actor_id,
    type,
    post_id,
    comment_id,
    title,
    body,
    metadata
  )
  values (
    p_user_id,
    v_actor_id,
    'mention',
    p_post_id,
    p_comment_id,
    'You were mentioned',
    case
      when p_comment_id is null then 'mentioned you in a post'
      else 'mentioned you in a comment'
    end,
    jsonb_build_object('source', case when p_comment_id is null then 'post' else 'comment' end)
  )
  on conflict do nothing
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;


ALTER FUNCTION "public"."create_mention_notification"("p_user_id" "uuid", "p_post_id" "uuid", "p_comment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_notification_settings_for_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.notification_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."create_notification_settings_for_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_post_transactional"("p_title" "text", "p_body" "text", "p_visibility" "text", "p_is_sticky" boolean DEFAULT false, "p_gif" "jsonb" DEFAULT NULL::"jsonb", "p_poll" "jsonb" DEFAULT NULL::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_post_id uuid;
  v_poll_id uuid;
  v_option text;
  v_option_index integer := 0;
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  perform public.assert_current_user_can_interact();

  select p.role into v_role
  from public.profiles p
  where p.id = auth.uid();

  insert into public.posts (
    user_id,
    title,
    body,
    visibility,
    is_sticky
  )
  values (
    auth.uid(),
    nullif(trim(coalesce(p_title, '')), ''),
    nullif(trim(coalesce(p_body, '')), ''),
    coalesce(nullif(trim(coalesce(p_visibility, '')), ''), 'public'),
    coalesce(v_role = 'ceo' and p_is_sticky, false)
  )
  returning id into v_post_id;

  if p_gif is not null then
    insert into public.post_media (
      post_id,
      user_id,
      media_type,
      provider,
      source,
      external_id,
      external_url,
      thumbnail_url,
      title,
      sort_order,
      display_order
    )
    values (
      v_post_id,
      auth.uid(),
      'gif',
      'giphy',
      'giphy',
      nullif(p_gif->>'external_id', ''),
      p_gif->>'external_url',
      nullif(p_gif->>'thumbnail_url', ''),
      nullif(p_gif->>'title', ''),
      coalesce((p_gif->>'sort_order')::integer, 0),
      coalesce((p_gif->>'display_order')::integer, 0)
    );
  end if;

  if p_poll is not null then
    insert into public.polls (
      post_id,
      question,
      allows_multiple
    )
    values (
      v_post_id,
      p_poll->>'question',
      coalesce((p_poll->>'allows_multiple')::boolean, false)
    )
    returning id into v_poll_id;

    for v_option in
      select jsonb_array_elements_text(coalesce(p_poll->'options', '[]'::jsonb))
    loop
      insert into public.poll_options (
        poll_id,
        option_text,
        display_order
      )
      values (
        v_poll_id,
        v_option,
        v_option_index
      );

      v_option_index := v_option_index + 1;
    end loop;
  end if;

  return v_post_id;
end;
$$;


ALTER FUNCTION "public"."create_post_transactional"("p_title" "text", "p_body" "text", "p_visibility" "text", "p_is_sticky" boolean, "p_gif" "jsonb", "p_poll" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_reply_notification"("p_parent_comment_id" "uuid", "p_reply_comment_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor_id uuid := auth.uid();
  v_parent_owner_id uuid;
  v_post_id uuid;
  v_notification_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  select c.user_id, c.post_id
  into v_parent_owner_id, v_post_id
  from public.comments c
  where c.id = p_parent_comment_id
    and coalesce(c.is_deleted, false) = false;

  if v_parent_owner_id is null then
    raise exception 'Parent comment not found';
  end if;

  if v_parent_owner_id = v_actor_id then
    return null;
  end if;

  if not exists (
    select 1
    from public.comments c
    where c.id = p_reply_comment_id
      and c.post_id = v_post_id
      and c.user_id = v_actor_id
      and coalesce(c.is_deleted, false) = false
  ) then
    raise exception 'Reply notification denied: actor does not own reply';
  end if;

  if not public.should_create_notification(v_parent_owner_id, 'reply') then
    return null;
  end if;

  insert into public.notifications (
    user_id,
    actor_id,
    type,
    post_id,
    comment_id,
    title,
    body,
    metadata
  )
  values (
    v_parent_owner_id,
    v_actor_id,
    'reply',
    v_post_id,
    p_reply_comment_id,
    'New reply',
    'replied to your comment',
    jsonb_build_object('source', 'reply', 'parent_comment_id', p_parent_comment_id)
  )
  on conflict do nothing
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;


ALTER FUNCTION "public"."create_reply_notification"("p_parent_comment_id" "uuid", "p_reply_comment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_can_interact"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_deleted, false) = false
        and coalesce(p.is_banned, false) = false
        and coalesce(p.is_muted, false) = false
    );
$$;


ALTER FUNCTION "public"."current_user_can_interact"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_is_ceo"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'ceo'
        and coalesce(p.is_banned, false) = false
        and coalesce(p.is_deleted, false) = false
    );
$$;


ALTER FUNCTION "public"."current_user_is_ceo"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_ceo_sticky_posts"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_role text;
begin
  if coalesce(new.is_sticky, false) = true then
    select role
    into v_role
    from public.profiles
    where id = auth.uid();

    if v_role is distinct from 'ceo' then
      raise exception 'Only CEO users can create official sticky posts.';
    end if;

    new.is_sticky = true;
    new.sticky_at = coalesce(new.sticky_at, now());
    new.sticky_by = coalesce(new.sticky_by, auth.uid());

    return new;
  end if;

  new.is_sticky = false;
  new.sticky_at = null;
  new.sticky_by = null;

  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_ceo_sticky_posts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_admin_nav_counts"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor_role text := public.get_current_moderation_actor_role();
  v_reports integer := 0;
  v_abuse_reports integer := 0;
  v_reviews integer := 0;
  v_role_reviews integer := 0;
  v_total integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if v_actor_role not in ('moderator', 'admin', 'ceo') then
    raise exception 'Moderator permission required';
  end if;

  select count(*)::integer
  into v_reports
  from public.post_reports pr
  where pr.status in (
    'pending',
    'under_review',
    'escalated',
    'ban_recommended',
    -- Current legacy report status used by the existing moderation UI.
    'open'
  );

  if v_actor_role in ('admin', 'ceo')
    and to_regclass('public.abuse_reports') is not null then
    select count(*)::integer
    into v_abuse_reports
    from public.abuse_reports ar
    where ar.status in (
      'pending',
      'under_review',
      -- Current legacy abuse report statuses used by the existing abuse UI.
      'new',
      'reviewing'
    );
  end if;

  if v_actor_role in ('admin', 'ceo')
    and to_regclass('public.moderation_reviews') is not null then
    execute
      'select count(*)::integer
       from public.moderation_reviews mr
       where mr.status in (''pending'', ''under_review'', ''escalated'')'
    into v_reviews;
  end if;

  -- Future role-review workflow count. Keep zero until a real table/route exists.
  v_role_reviews := 0;

  v_total := v_reports + v_abuse_reports + v_reviews + v_role_reviews;

  return jsonb_build_object(
    'reports', v_reports,
    'abuseReports', v_abuse_reports,
    'reviews', v_reviews,
    'roleReviews', v_role_reviews,
    'total', v_total
  );
end;
$$;


ALTER FUNCTION "public"."get_admin_nav_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_current_moderation_actor_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
    and coalesce(p.is_banned, false) = false
    and coalesce(p.is_deleted, false) = false
  limit 1;
$$;


ALTER FUNCTION "public"."get_current_moderation_actor_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_feed_post_ranks"("p_post_ids" "uuid"[]) RETURNS TABLE("post_id" "uuid", "feed_rank" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with viewer as (
    select
      p.id,
      lower(nullif(trim(p.state), '')) as state
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.is_deleted, false) = false
    limit 1
  ),
  accepted_friend_ids as (
    select
      case
        when f.requester_id = auth.uid() then f.addressee_id
        else f.requester_id
      end as friend_id
    from public.friends f
    where auth.uid() is not null
      and f.status = 'accepted'
      and (
        f.requester_id = auth.uid()
        or f.addressee_id = auth.uid()
      )
  )
  select
    p.id as post_id,
    case
      when auth.uid() is not null
        and p.user_id = auth.uid()
        then 4
      when auth.uid() is not null
        and p.user_id in (select friend_id from accepted_friend_ids)
        then 3
      when auth.uid() is not null
        and v.state is not null
        and lower(nullif(trim(author_profile.state), '')) = v.state
        then 2
      else 1
    end as feed_rank
  from public.posts p
  left join public.profiles author_profile
    on author_profile.id = p.user_id
    and coalesce(author_profile.is_deleted, false) = false
  left join viewer v
    on true
  where p.id = any(p_post_ids)
    and p.is_deleted = false
    and p.visibility = 'public';
$$;


ALTER FUNCTION "public"."get_feed_post_ranks"("p_post_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_friend_suggestions"("p_limit" integer DEFAULT 4) RETURNS TABLE("id" "uuid", "username" "text", "display_name" "text", "avatar_cloudinary_url" "text", "suggestion_reason" "text", "mutual_friend_count" integer, "rank_score" integer)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with viewer as (
    select
      p.id as viewer_id,
      nullif(lower(trim(p.state)), '') as viewer_state
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.is_banned, false) = false
      and coalesce(p.is_deleted, false) = false
  ),
  existing_relationships as (
    select
      case
        when f.requester_id = auth.uid() then f.addressee_id
        else f.requester_id
      end as other_user_id,
      f.status
    from public.friends f
    where f.requester_id = auth.uid()
       or f.addressee_id = auth.uid()
  ),
  accepted_friends as (
    select er.other_user_id as friend_id
    from existing_relationships er
    join public.profiles mutual_profile
      on mutual_profile.id = er.other_user_id
    where er.status = 'accepted'
      and coalesce(mutual_profile.role, 'user') <> 'ceo'
  ),
  friend_edges as (
    select
      af.friend_id,
      case
        when f.requester_id = af.friend_id then f.addressee_id
        else f.requester_id
      end as candidate_id
    from accepted_friends af
    join public.friends f
      on f.status = 'accepted'
     and (
       f.requester_id = af.friend_id
       or f.addressee_id = af.friend_id
     )
  ),
  mutuals as (
    select
      fe.candidate_id,
      count(distinct fe.friend_id)::integer as mutual_friend_count
    from friend_edges fe
    where fe.candidate_id <> auth.uid()
    group by fe.candidate_id
  ),
  activity as (
    select
      recent.user_id,
      max(recent.activity_at) as recent_activity_at
    from (
      select
        p.user_id,
        greatest(p.created_at, p.updated_at) as activity_at
      from public.posts p
      where coalesce(p.is_deleted, false) = false
        and p.visibility = 'public'

      union all

      select
        c.user_id,
        greatest(c.created_at, c.updated_at) as activity_at
      from public.comments c
      where coalesce(c.is_deleted, false) = false
    ) recent
    group by recent.user_id
  ),
  candidates as (
    select
      p.id,
      p.username,
      p.display_name,
      p.avatar_cloudinary_url,
      coalesce(m.mutual_friend_count, 0)::integer as mutual_friend_count,
      (
        v.viewer_state is not null
        and nullif(lower(trim(p.state)), '') is not null
        and nullif(lower(trim(p.state)), '') = v.viewer_state
      ) as same_state,
      a.recent_activity_at
    from public.profiles p
    cross join viewer v
    left join mutuals m
      on m.candidate_id = p.id
    left join activity a
      on a.user_id = p.id
    where p.id <> v.viewer_id
      and coalesce(p.is_banned, false) = false
      and coalesce(p.is_deleted, false) = false
      and coalesce(p.is_muted, false) = false
      and not exists (
        select 1
        from existing_relationships er
        where er.other_user_id = p.id
      )
  ),
  ranked as (
    select
      c.*,
      case
        when c.mutual_friend_count > 0 and c.same_state then 400 + c.mutual_friend_count
        when c.mutual_friend_count > 0 then 300 + c.mutual_friend_count
        when c.same_state then 200
        when c.recent_activity_at is not null then 100
        else 0
      end as computed_rank_score
    from candidates c
  )
  select
    r.id,
    r.username,
    r.display_name,
    r.avatar_cloudinary_url,
    case
      when r.mutual_friend_count > 0 and r.same_state then
        r.mutual_friend_count::text
        || case when r.mutual_friend_count = 1 then ' mutual friend' else ' mutual friends' end
        || ' · Also in your state'
      when r.mutual_friend_count > 0 then
        r.mutual_friend_count::text
        || case when r.mutual_friend_count = 1 then ' mutual friend' else ' mutual friends' end
      when r.same_state then 'Also in your state'
      else 'Active recently'
    end as suggestion_reason,
    r.mutual_friend_count,
    r.computed_rank_score as rank_score
  from ranked r
  where r.computed_rank_score > 0
  order by
    r.computed_rank_score desc,
    r.mutual_friend_count desc,
    r.recent_activity_at desc nulls last,
    random()
  limit least(greatest(coalesce(p_limit, 4), 1), 20);
$$;


ALTER FUNCTION "public"."get_friend_suggestions"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_moderation_event_email_context"("p_event_id" "uuid") RETURNS TABLE("moderation_event_id" "uuid", "user_id" "uuid", "email" "text", "username" "text", "display_name" "text", "action" "text", "reason" "text", "expires_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    me.id as moderation_event_id,
    p.id as user_id,
    p.email,
    p.username,
    p.display_name,
    me.action,
    me.reason,
    me.expires_at
  from public.moderation_events me
  join public.profiles p
    on p.id = me.user_id
  where me.id = p_event_id
    and me.moderator_id = auth.uid()
    and public.is_moderator_or_above()
  limit 1;
$$;


ALTER FUNCTION "public"."get_moderation_event_email_context"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_moderation_profile_cards"("p_profile_ids" "uuid"[]) RETURNS TABLE("id" "uuid", "username" "text", "display_name" "text", "first_name" "text", "last_name" "text", "avatar_cloudinary_url" "text", "profile_badge" "text", "role" "text", "is_banned" boolean, "is_muted" boolean, "is_deleted" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    p.id,
    p.username,
    p.display_name,
    p.first_name,
    p.last_name,
    p.avatar_cloudinary_url,
    p.profile_badge,
    p.role,
    coalesce(p.is_banned, false) as is_banned,
    coalesce(p.is_muted, false) as is_muted,
    coalesce(p.is_deleted, false) as is_deleted
  from public.profiles p
  where p.id = any(p_profile_ids)
    and public.is_moderator_or_above();
$$;


ALTER FUNCTION "public"."get_moderation_profile_cards"("p_profile_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_poll_responses"("p_poll_ids" "uuid"[]) RETURNS TABLE("poll_id" "uuid", "option_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select pr.poll_id, pr.option_id
  from public.poll_responses pr
  join public.polls poll on poll.id = pr.poll_id
  join public.posts p on p.id = poll.post_id
  where auth.uid() is not null
    and pr.user_id = auth.uid()
    and pr.poll_id = any(p_poll_ids)
    and p.is_deleted = false
    and p.visibility = 'public';
$$;


ALTER FUNCTION "public"."get_my_poll_responses"("p_poll_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_post_votes"("p_post_ids" "uuid"[]) RETURNS TABLE("post_id" "uuid", "user_vote" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    pv.post_id,
    pv.vote_type as user_vote
  from public.post_votes pv
  join public.posts p
    on p.id = pv.post_id
  where pv.user_id = auth.uid()
    and pv.post_id = any(p_post_ids)
    and coalesce(p.is_deleted, false) = false
    and p.visibility = 'public';
$$;


ALTER FUNCTION "public"."get_my_post_votes"("p_post_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_profile"() RETURNS TABLE("id" "uuid", "email" "text", "username" "text", "first_name" "text", "last_name" "text", "display_name" "text", "avatar_cloudinary_url" "text", "banner_cloudinary_url" "text", "profile_badge" "text", "city" "text", "state" "text", "bio" "text", "dob" "date", "age_verified_at" timestamp with time zone, "age_gate_version" "text", "birthday_messages_enabled" boolean, "last_seen_rank_key" "text", "last_seen_rank_at" timestamp with time zone, "privacy_settings" "jsonb", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    p.id,
    p.email,
    p.username,
    p.first_name,
    p.last_name,
    p.display_name,
    p.avatar_cloudinary_url,
    p.banner_cloudinary_url,
    p.profile_badge,
    p.city,
    p.state,
    p.bio,
    p.dob,
    p.age_verified_at,
    p.age_gate_version,
    p.birthday_messages_enabled,
    p.last_seen_rank_key,
    p.last_seen_rank_at,
    p.privacy_settings,
    p.created_at,
    p.updated_at
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;


ALTER FUNCTION "public"."get_my_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_profile_auth_status"() RETURNS TABLE("id" "uuid", "username" "text", "role" "text", "dob" "date", "age_verified_at" timestamp with time zone, "is_banned" boolean, "is_muted" boolean, "is_deleted" boolean)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    p.id,
    p.username,
    p.role,
    p.dob,
    p.age_verified_at,
    coalesce(p.is_banned, false) as is_banned,
    coalesce(p.is_muted, false) as is_muted,
    coalesce(p.is_deleted, false) as is_deleted
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;


ALTER FUNCTION "public"."get_my_profile_auth_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_poll_results"("p_poll_ids" "uuid"[]) RETURNS TABLE("poll_id" "uuid", "option_id" "uuid", "vote_count" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    po.poll_id,
    po.id as option_id,
    count(pr.id)::integer as vote_count
  from public.poll_options po
  join public.polls poll on poll.id = po.poll_id
  join public.posts p on p.id = poll.post_id
  left join public.poll_responses pr
    on pr.option_id = po.id
   and pr.poll_id = po.poll_id
  where po.poll_id = any(p_poll_ids)
    and p.is_deleted = false
    and p.visibility = 'public'
  group by po.poll_id, po.id, po.display_order
  order by po.poll_id, po.display_order;
$$;


ALTER FUNCTION "public"."get_poll_results"("p_poll_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_post_reports_for_moderation"() RETURNS TABLE("id" "uuid", "post_id" "uuid", "reporter_id" "uuid", "reason" "text", "details" "text", "status" "text", "reviewed_by" "uuid", "reviewed_at" timestamp with time zone, "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "post" "jsonb", "reporter" "jsonb", "reviewer" "jsonb", "post_author" "jsonb")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.is_moderator_or_above() then
    raise exception 'Moderator permission required';
  end if;

  return query
  select
    pr.id,
    pr.post_id,
    pr.reporter_id,
    pr.reason,
    pr.details,
    pr.status,
    pr.reviewed_by,
    pr.reviewed_at,
    pr.created_at,
    pr.updated_at,
    case
      when p.id is null then null
      else jsonb_build_object(
        'id', p.id,
        'title', p.title,
        'body', p.body,
        'user_id', p.user_id,
        'visibility', p.visibility,
        'is_deleted', p.is_deleted,
        'deleted_at', p.deleted_at,
        'removed_at', p.removed_at,
        'removed_by', p.removed_by,
        'removal_reason', p.removal_reason,
        'restored_at', p.restored_at,
        'restored_by', p.restored_by,
        'created_at', p.created_at
      )
    end as post,
    case
      when reporter.id is null then null
      else jsonb_build_object(
        'id', reporter.id,
        'username', reporter.username,
        'display_name', reporter.display_name,
        'first_name', reporter.first_name,
        'last_name', reporter.last_name,
        'avatar_cloudinary_url', reporter.avatar_cloudinary_url,
        'profile_badge', reporter.profile_badge,
        'role', reporter.role,
        'is_banned', coalesce(reporter.is_banned, false),
        'is_muted', coalesce(reporter.is_muted, false),
        'is_deleted', coalesce(reporter.is_deleted, false)
      )
    end as reporter,
    case
      when reviewer.id is null then null
      else jsonb_build_object(
        'id', reviewer.id,
        'username', reviewer.username,
        'display_name', reviewer.display_name,
        'first_name', reviewer.first_name,
        'last_name', reviewer.last_name,
        'avatar_cloudinary_url', reviewer.avatar_cloudinary_url,
        'profile_badge', reviewer.profile_badge,
        'role', reviewer.role,
        'is_banned', coalesce(reviewer.is_banned, false),
        'is_muted', coalesce(reviewer.is_muted, false),
        'is_deleted', coalesce(reviewer.is_deleted, false)
      )
    end as reviewer,
    case
      when author.id is null then null
      else jsonb_build_object(
        'id', author.id,
        'username', author.username,
        'display_name', author.display_name,
        'first_name', author.first_name,
        'last_name', author.last_name,
        'avatar_cloudinary_url', author.avatar_cloudinary_url,
        'profile_badge', author.profile_badge,
        'role', author.role,
        'is_banned', coalesce(author.is_banned, false),
        'is_muted', coalesce(author.is_muted, false),
        'is_deleted', coalesce(author.is_deleted, false)
      )
    end as post_author
  from public.post_reports pr
  left join public.posts p
    on p.id = pr.post_id
  left join public.profiles reporter
    on reporter.id = pr.reporter_id
  left join public.profiles reviewer
    on reviewer.id = pr.reviewed_by
  left join public.profiles author
    on author.id = p.user_id
  order by pr.created_at desc;
end;
$$;


ALTER FUNCTION "public"."get_post_reports_for_moderation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_post_vote_counts"("p_post_ids" "uuid"[]) RETURNS TABLE("post_id" "uuid", "upvote_count" integer, "downvote_count" integer, "score" integer, "vote_score" integer, "vote_count" integer, "interaction_count" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    pvc.post_id,
    pvc.upvote_count,
    pvc.downvote_count,
    pvc.score,
    pvc.vote_score,
    pvc.vote_count,
    pvc.interaction_count
  from public.post_vote_counts pvc
  where pvc.post_id = any(coalesce(p_post_ids, '{}'::uuid[]));
$$;


ALTER FUNCTION "public"."get_post_vote_counts"("p_post_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_profile_friend_count"("target_user_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select count(*)::integer
  from public.friends f
  where f.status = 'accepted'
    and public.is_profile_visible(target_user_id)
    and (
      f.requester_id = target_user_id
      or f.addressee_id = target_user_id
    );
$$;


ALTER FUNCTION "public"."get_profile_friend_count"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_public_profile"("p_profile_id" "uuid") RETURNS TABLE("id" "uuid", "username" "text", "display_name" "text", "first_name" "text", "last_name" "text", "birthday_display" "text", "email" "text", "city" "text", "state" "text", "bio" "text", "avatar_cloudinary_url" "text", "banner_cloudinary_url" "text", "profile_badge" "text", "privacy_settings" "jsonb", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    p.id,
    p.username,
    p.display_name,
    case
      when case
        when lower(p.privacy_settings #>> '{profile_visibility,show_real_name}') in ('true', 'false')
          then (p.privacy_settings #>> '{profile_visibility,show_real_name}')::boolean
        else false
      end then p.first_name
      else null
    end as first_name,
    case
      when case
        when lower(p.privacy_settings #>> '{profile_visibility,show_real_name}') in ('true', 'false')
          then (p.privacy_settings #>> '{profile_visibility,show_real_name}')::boolean
        else false
      end then p.last_name
      else null
    end as last_name,
    case
      when p.dob is not null
        and case
          when lower(p.privacy_settings #>> '{profile_visibility,show_birthday}') in ('true', 'false')
            then (p.privacy_settings #>> '{profile_visibility,show_birthday}')::boolean
          else false
        end then to_char(p.dob, 'FMMonth FMDD')
      else null
    end as birthday_display,
    case
      when case
        when lower(p.privacy_settings #>> '{profile_visibility,show_email}') in ('true', 'false')
          then (p.privacy_settings #>> '{profile_visibility,show_email}')::boolean
        else false
      end then p.email
      else null
    end as email,
    case
      when case
        when lower(p.privacy_settings #>> '{profile_visibility,show_city}') in ('true', 'false')
          then (p.privacy_settings #>> '{profile_visibility,show_city}')::boolean
        else false
      end then p.city
      else null
    end as city,
    case
      when case
        when lower(p.privacy_settings #>> '{profile_visibility,show_state}') in ('true', 'false')
          then (p.privacy_settings #>> '{profile_visibility,show_state}')::boolean
        else false
      end then p.state
      else null
    end as state,
    p.bio,
    p.avatar_cloudinary_url,
    p.banner_cloudinary_url,
    p.profile_badge,
    null::jsonb as privacy_settings,
    p.created_at,
    p.updated_at
  from public.profiles p
  where p.id = p_profile_id
    and coalesce(p.is_deleted, false) = false
  limit 1;
$$;


ALTER FUNCTION "public"."get_public_profile"("p_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_public_profile_cards"("p_profile_ids" "uuid"[]) RETURNS TABLE("id" "uuid", "username" "text", "display_name" "text", "first_name" "text", "last_name" "text", "avatar_cloudinary_url" "text", "profile_badge" "text", "city" "text", "state" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    p.id,
    p.username,
    p.display_name,
    case
      when case
        when lower(p.privacy_settings #>> '{profile_visibility,show_real_name}') in ('true', 'false')
          then (p.privacy_settings #>> '{profile_visibility,show_real_name}')::boolean
        else false
      end then p.first_name
      else null
    end as first_name,
    case
      when case
        when lower(p.privacy_settings #>> '{profile_visibility,show_real_name}') in ('true', 'false')
          then (p.privacy_settings #>> '{profile_visibility,show_real_name}')::boolean
        else false
      end then p.last_name
      else null
    end as last_name,
    p.avatar_cloudinary_url,
    p.profile_badge,
    case
      when case
        when lower(p.privacy_settings #>> '{profile_visibility,show_city}') in ('true', 'false')
          then (p.privacy_settings #>> '{profile_visibility,show_city}')::boolean
        else false
      end then p.city
      else null
    end as city,
    case
      when case
        when lower(p.privacy_settings #>> '{profile_visibility,show_state}') in ('true', 'false')
          then (p.privacy_settings #>> '{profile_visibility,show_state}')::boolean
        else false
      end then p.state
      else null
    end as state
  from public.profiles p
  where p.id = any(p_profile_ids)
    and coalesce(p.is_deleted, false) = false;
$$;


ALTER FUNCTION "public"."get_public_profile_cards"("p_profile_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_rank"("p_user_id" "uuid") RETURNS TABLE("user_id" "uuid", "post_count" integer, "rank_key" "text", "rank_label" "text", "next_rank_key" "text", "next_rank_label" "text", "next_rank_min_posts" integer, "posts_until_next_rank" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with target_profile as (
    select p.id
    from public.profiles p
    where p.id = p_user_id
      and coalesce(p.is_deleted, false) = false
    limit 1
  ),
  counts as (
    select
      tp.id as user_id,
      count(posts.id)::integer as post_count
    from target_profile tp
    left join public.posts posts
      on posts.user_id = tp.id
     and coalesce(posts.is_deleted, false) = false
     and posts.visibility = 'public'
    group by tp.id
  ),
  current_rank as (
    select
      c.user_id,
      c.post_count,
      threshold.key,
      threshold.label,
      threshold.sort_order
    from counts c
    join lateral (
      select t.key, t.label, t.sort_order
      from public.user_rank_thresholds t
      where t.is_active = true
        and t.min_posts <= c.post_count
      order by t.min_posts desc, t.sort_order desc
      limit 1
    ) threshold on true
  ),
  next_rank as (
    select
      cr.user_id,
      threshold.key,
      threshold.label,
      threshold.min_posts
    from current_rank cr
    left join lateral (
      select t.key, t.label, t.min_posts
      from public.user_rank_thresholds t
      where t.is_active = true
        and t.min_posts > cr.post_count
      order by t.min_posts asc, t.sort_order asc
      limit 1
    ) threshold on true
  )
  select
    cr.user_id,
    cr.post_count,
    cr.key as rank_key,
    cr.label as rank_label,
    nr.key as next_rank_key,
    nr.label as next_rank_label,
    nr.min_posts as next_rank_min_posts,
    case
      when nr.min_posts is null then 0
      else greatest(nr.min_posts - cr.post_count, 0)
    end as posts_until_next_rank
  from current_rank cr
  left join next_rank nr
    on nr.user_id = cr.user_id;
$$;


ALTER FUNCTION "public"."get_user_rank"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_dob date;
  v_age_gate_version text;
  v_birthday_messages_enabled boolean;
begin
  begin
    if new.raw_user_meta_data ? 'dob'
      and (new.raw_user_meta_data->>'dob') ~ '^\d{4}-\d{2}-\d{2}$'
    then
      v_dob := (new.raw_user_meta_data->>'dob')::date;
    end if;
  exception
    when others then
      v_dob := null;
  end;

  v_age_gate_version := nullif(trim(coalesce(new.raw_user_meta_data->>'age_gate_version', '')), '');
  v_birthday_messages_enabled := coalesce(
    case
      when lower(coalesce(new.raw_user_meta_data->>'birthday_messages_enabled', '')) in ('true', 't', '1', 'yes')
        then true
      when lower(coalesce(new.raw_user_meta_data->>'birthday_messages_enabled', '')) in ('false', 'f', '0', 'no')
        then false
      else null
    end,
    true
  );

  insert into public.profiles (
    id,
    email,
    username,
    display_name,
    first_name,
    last_name,
    dob,
    age_verified_at,
    age_gate_version,
    birthday_messages_enabled,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data->>'username', ''),
    nullif(new.raw_user_meta_data->>'display_name', ''),
    nullif(new.raw_user_meta_data->>'first_name', ''),
    nullif(new.raw_user_meta_data->>'last_name', ''),
    case when public.is_adult_dob(v_dob) then v_dob else null end,
    case when public.is_adult_dob(v_dob) then now() else null end,
    coalesce(v_age_gate_version, 'v1'),
    v_birthday_messages_enabled,
    now(),
    now()
  )
  on conflict (id) do update
  set
    email = excluded.email,
    dob = coalesce(public.profiles.dob, excluded.dob),
    age_verified_at = coalesce(public.profiles.age_verified_at, excluded.age_verified_at),
    age_gate_version = coalesce(nullif(public.profiles.age_gate_version, ''), excluded.age_gate_version, 'v1'),
    birthday_messages_enabled = coalesce(public.profiles.birthday_messages_enabled, excluded.birthday_messages_enabled, true),
    updated_at = now();

  return new;
end;
$_$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_account_moderation_notice"("p_target_user_id" "uuid", "p_moderator_id" "uuid", "p_action" "text", "p_reason" "text" DEFAULT NULL::"text", "p_expires_at" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_event_id uuid;
  v_notification_type text;
  v_title text;
  v_body text;
begin
  insert into public.moderation_events (
    user_id,
    moderator_id,
    action,
    reason,
    expires_at
  )
  values (
    p_target_user_id,
    p_moderator_id,
    p_action,
    nullif(trim(coalesce(p_reason, '')), ''),
    p_expires_at
  )
  returning id into v_event_id;

  v_notification_type := case p_action
    when 'muted' then 'account_muted'
    when 'banned' then 'account_banned'
    when 'unmuted' then 'account_unmuted'
    when 'unbanned' then 'account_unbanned'
    when 'warned' then 'moderation_warning'
    else null
  end;

  v_title := case p_action
    when 'muted' then 'Account muted'
    when 'banned' then 'Account banned'
    when 'unmuted' then 'Account unmuted'
    when 'unbanned' then 'Account unbanned'
    when 'warned' then 'Moderation warning'
    else 'Account notice'
  end;

  v_body := case p_action
    when 'muted' then 'Your TriggerFeed account has been muted.'
    when 'banned' then 'Your TriggerFeed account has been banned.'
    when 'unmuted' then 'Your TriggerFeed account has been unmuted.'
    when 'unbanned' then 'Your TriggerFeed account has been unbanned.'
    when 'warned' then 'You received a warning from TriggerFeed moderation.'
    else 'You received an account notice from TriggerFeed moderation.'
  end;

  if v_notification_type is not null then
    insert into public.notifications (
      user_id,
      actor_id,
      type,
      title,
      body,
      metadata
    )
    values (
      p_target_user_id,
      null,
      v_notification_type,
      v_title,
      v_body,
      jsonb_strip_nulls(jsonb_build_object(
        'action', p_action,
        'reason', nullif(trim(coalesce(p_reason, '')), ''),
        'expires_at', p_expires_at,
        'moderation_event_id', v_event_id
      ))
    );
  end if;

  return v_event_id;
end;
$$;


ALTER FUNCTION "public"."insert_account_moderation_notice"("p_target_user_id" "uuid", "p_moderator_id" "uuid", "p_action" "text", "p_reason" "text", "p_expires_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin_or_above"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'ceo')
        and coalesce(p.is_banned, false) = false
        and coalesce(p.is_deleted, false) = false
    );
$$;


ALTER FUNCTION "public"."is_admin_or_above"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin_or_ceo"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'ceo')
      and coalesce(p.is_banned, false) = false
      and coalesce(p.is_deleted, false) = false
  );
$$;


ALTER FUNCTION "public"."is_admin_or_ceo"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_adult_dob"("p_dob" "date") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select p_dob is not null
    and p_dob <= (current_date - interval '18 years')::date
    and p_dob >= date '1900-01-01';
$$;


ALTER FUNCTION "public"."is_adult_dob"("p_dob" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_ceo"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'ceo'
        and coalesce(p.is_banned, false) = false
        and coalesce(p.is_deleted, false) = false
    );
$$;


ALTER FUNCTION "public"."is_ceo"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_moderator_or_above"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('moderator', 'admin', 'ceo')
        and coalesce(p.is_banned, false) = false
        and coalesce(p.is_deleted, false) = false
    );
$$;


ALTER FUNCTION "public"."is_moderator_or_above"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_profile_visible"("p_profile_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_profile_id
      and coalesce(p.is_deleted, false) = false
  );
$$;


ALTER FUNCTION "public"."is_profile_visible"("p_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_moderation_event_email_result"("p_event_id" "uuid", "p_email_sent" boolean, "p_email_error" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_event_id uuid;
begin
  if not public.is_moderator_or_above() then
    raise exception 'Moderator permission required';
  end if;

  update public.moderation_events me
  set
    email_sent_at = case when p_email_sent then now() else null end,
    email_error = case
      when p_email_sent then null
      else nullif(trim(coalesce(p_email_error, '')), '')
    end
  where me.id = p_event_id
    and me.moderator_id = auth.uid()
  returning me.id into v_event_id;

  if v_event_id is null then
    raise exception 'Moderation event not found';
  end if;

  return v_event_id;
end;
$$;


ALTER FUNCTION "public"."mark_moderation_event_email_result"("p_event_id" "uuid", "p_email_sent" boolean, "p_email_error" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."moderation_add_admin_note"("p_target_user_id" "uuid", "p_note" "text", "p_related_post_id" "uuid" DEFAULT NULL::"uuid", "p_related_report_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_action_id uuid;
begin
  if not public.is_moderator_or_above() then
    raise exception 'Moderator permission required';
  end if;

  if nullif(trim(coalesce(p_note, '')), '') is null then
    raise exception 'Admin note is required';
  end if;

  if not exists (select 1 from public.moderation_assert_target_profile(p_target_user_id)) then
    raise exception 'Target user not found';
  end if;

  insert into public.moderation_actions (
    target_user_id,
    actor_user_id,
    related_post_id,
    related_report_id,
    action_type,
    message
  )
  values (
    p_target_user_id,
    auth.uid(),
    p_related_post_id,
    p_related_report_id,
    'admin_note',
    nullif(trim(coalesce(p_note, '')), '')
  )
  returning id into v_action_id;

  return v_action_id;
end;
$$;


ALTER FUNCTION "public"."moderation_add_admin_note"("p_target_user_id" "uuid", "p_note" "text", "p_related_post_id" "uuid", "p_related_report_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."moderation_assert_target_profile"("p_target_user_id" "uuid") RETURNS TABLE("id" "uuid", "role" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select p.id, p.role
  from public.profiles p
  where p.id = p_target_user_id
    and coalesce(p.is_deleted, false) = false
  limit 1;
$$;


ALTER FUNCTION "public"."moderation_assert_target_profile"("p_target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."moderation_ban_user"("p_target_user_id" "uuid", "p_reason" "text", "p_expires_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_related_post_id" "uuid" DEFAULT NULL::"uuid", "p_related_report_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_target record;
  v_action_id uuid;
begin
  if public.get_current_moderation_actor_role() <> 'ceo' then
    raise exception 'CEO permission required';
  end if;

  select * into v_target
  from public.moderation_assert_target_profile(p_target_user_id)
  limit 1;

  if v_target.id is null then
    raise exception 'Target user not found';
  end if;

  if p_target_user_id = auth.uid() or v_target.role = 'ceo' then
    raise exception 'You cannot ban this user';
  end if;

  update public.profiles
  set is_banned = true,
      updated_at = now()
  where id = p_target_user_id;

  insert into public.moderation_actions (
    target_user_id,
    actor_user_id,
    related_post_id,
    related_report_id,
    action_type,
    reason,
    expires_at
  )
  values (
    p_target_user_id,
    auth.uid(),
    p_related_post_id,
    p_related_report_id,
    'ban',
    nullif(trim(coalesce(p_reason, '')), ''),
    p_expires_at
  )
  returning id into v_action_id;

  if p_related_report_id is not null then
    update public.post_reports
    set status = 'banned',
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        updated_at = now()
    where id = p_related_report_id;
  end if;

  return v_action_id;
end;
$$;


ALTER FUNCTION "public"."moderation_ban_user"("p_target_user_id" "uuid", "p_reason" "text", "p_expires_at" timestamp with time zone, "p_related_post_id" "uuid", "p_related_report_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."moderation_mute_user"("p_target_user_id" "uuid", "p_reason" "text", "p_expires_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_related_post_id" "uuid" DEFAULT NULL::"uuid", "p_related_report_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor_role text := public.get_current_moderation_actor_role();
  v_target record;
  v_action_id uuid;
begin
  -- TODO: add duration-specific mute tiers when the schema supports them.
  if v_actor_role not in ('admin', 'ceo') then
    raise exception 'Admin permission required';
  end if;

  select * into v_target
  from public.moderation_assert_target_profile(p_target_user_id)
  limit 1;

  if v_target.id is null then
    raise exception 'Target user not found';
  end if;

  if p_target_user_id = auth.uid()
    or v_target.role = 'ceo'
    or (v_actor_role = 'admin' and v_target.role not in ('user', 'moderator')) then
    raise exception 'You cannot mute this user';
  end if;

  update public.profiles
  set is_muted = true,
      updated_at = now()
  where id = p_target_user_id;

  insert into public.moderation_actions (
    target_user_id,
    actor_user_id,
    related_post_id,
    related_report_id,
    action_type,
    reason,
    expires_at
  )
  values (
    p_target_user_id,
    auth.uid(),
    p_related_post_id,
    p_related_report_id,
    'mute',
    nullif(trim(coalesce(p_reason, '')), ''),
    p_expires_at
  )
  returning id into v_action_id;

  if p_related_report_id is not null then
    update public.post_reports
    set status = 'muted',
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        updated_at = now()
    where id = p_related_report_id;
  end if;

  return v_action_id;
end;
$$;


ALTER FUNCTION "public"."moderation_mute_user"("p_target_user_id" "uuid", "p_reason" "text", "p_expires_at" timestamp with time zone, "p_related_post_id" "uuid", "p_related_report_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."moderation_remove_post"("p_post_id" "uuid", "p_reason" "text", "p_related_report_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor_role text := public.get_current_moderation_actor_role();
  v_post record;
  v_action_id uuid;
begin
  if v_actor_role not in ('moderator', 'admin', 'ceo') then
    raise exception 'Moderator permission required';
  end if;

  select
    p.id,
    p.user_id,
    p.is_deleted,
    author.role as author_role
  into v_post
  from public.posts p
  left join public.profiles author
    on author.id = p.user_id
  where p.id = p_post_id;

  if v_post.id is null then
    raise exception 'Post not found';
  end if;

  if v_actor_role = 'moderator' then
    if v_post.author_role <> 'user' then
      raise exception 'You cannot remove this post';
    end if;
  elsif v_actor_role = 'admin' then
    if v_post.author_role is null or v_post.author_role not in ('user', 'moderator') then
      raise exception 'You cannot remove this post';
    end if;
  end if;

  if coalesce(v_post.is_deleted, false) = false then
    update public.posts
    set is_deleted = true,
        deleted_at = now(),
        removed_at = now(),
        removed_by = auth.uid(),
        removal_reason = nullif(trim(coalesce(p_reason, '')), ''),
        restored_at = null,
        restored_by = null,
        updated_at = now()
    where id = p_post_id;
  end if;

  if p_related_report_id is not null then
    update public.post_reports
    set status = 'post_removed',
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        updated_at = now()
    where id = p_related_report_id;
  end if;

  insert into public.moderation_actions (
    target_user_id,
    actor_user_id,
    related_post_id,
    related_report_id,
    action_type,
    reason
  )
  values (
    v_post.user_id,
    auth.uid(),
    p_post_id,
    p_related_report_id,
    'remove_post',
    nullif(trim(coalesce(p_reason, '')), '')
  )
  returning id into v_action_id;

  return v_action_id;
end;
$$;


ALTER FUNCTION "public"."moderation_remove_post"("p_post_id" "uuid", "p_reason" "text", "p_related_report_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."moderation_restore_post"("p_post_id" "uuid", "p_reason" "text" DEFAULT NULL::"text", "p_related_report_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_post record;
  v_action_id uuid;
begin
  if public.get_current_moderation_actor_role() <> 'ceo' then
    raise exception 'CEO permission required';
  end if;

  select p.id, p.user_id, p.is_deleted
  into v_post
  from public.posts p
  where p.id = p_post_id;

  if v_post.id is null then
    raise exception 'Post not found';
  end if;

  if coalesce(v_post.is_deleted, false) = true then
    update public.posts
    set is_deleted = false,
        deleted_at = null,
        restored_at = now(),
        restored_by = auth.uid(),
        updated_at = now()
    where id = p_post_id;
  end if;

  if p_related_report_id is not null then
    update public.post_reports
    set status = 'reviewed',
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        updated_at = now()
    where id = p_related_report_id;
  end if;

  insert into public.moderation_actions (
    target_user_id,
    actor_user_id,
    related_post_id,
    related_report_id,
    action_type,
    reason
  )
  values (
    v_post.user_id,
    auth.uid(),
    p_post_id,
    p_related_report_id,
    'restore_post',
    nullif(trim(coalesce(p_reason, '')), '')
  )
  returning id into v_action_id;

  return v_action_id;
end;
$$;


ALTER FUNCTION "public"."moderation_restore_post"("p_post_id" "uuid", "p_reason" "text", "p_related_report_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."moderation_unban_user"("p_target_user_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_target record;
  v_action_id uuid;
begin
  if public.get_current_moderation_actor_role() <> 'ceo' then
    raise exception 'CEO permission required';
  end if;

  select * into v_target
  from public.moderation_assert_target_profile(p_target_user_id)
  limit 1;

  if v_target.id is null then
    raise exception 'Target user not found';
  end if;

  if p_target_user_id = auth.uid() or v_target.role = 'ceo' then
    raise exception 'You cannot unban this user';
  end if;

  update public.profiles
  set is_banned = false,
      updated_at = now()
  where id = p_target_user_id;

  insert into public.moderation_actions (
    target_user_id,
    actor_user_id,
    action_type,
    reason
  )
  values (
    p_target_user_id,
    auth.uid(),
    'unban',
    nullif(trim(coalesce(p_reason, '')), '')
  )
  returning id into v_action_id;

  return v_action_id;
end;
$$;


ALTER FUNCTION "public"."moderation_unban_user"("p_target_user_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."moderation_unmute_user"("p_target_user_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor_role text := public.get_current_moderation_actor_role();
  v_target record;
  v_action_id uuid;
begin
  if v_actor_role not in ('admin', 'ceo') then
    raise exception 'Admin permission required';
  end if;

  select * into v_target
  from public.moderation_assert_target_profile(p_target_user_id)
  limit 1;

  if v_target.id is null then
    raise exception 'Target user not found';
  end if;

  if p_target_user_id = auth.uid()
    or v_target.role = 'ceo'
    or (v_actor_role = 'admin' and v_target.role not in ('user', 'moderator')) then
    raise exception 'You cannot unmute this user';
  end if;

  update public.profiles
  set is_muted = false,
      updated_at = now()
  where id = p_target_user_id;

  insert into public.moderation_actions (
    target_user_id,
    actor_user_id,
    action_type,
    reason
  )
  values (
    p_target_user_id,
    auth.uid(),
    'unmute',
    nullif(trim(coalesce(p_reason, '')), '')
  )
  returning id into v_action_id;

  return v_action_id;
end;
$$;


ALTER FUNCTION "public"."moderation_unmute_user"("p_target_user_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."moderation_update_report_status"("p_report_id" "uuid", "p_status" "text", "p_reason" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor_role text := public.get_current_moderation_actor_role();
  v_status text := lower(trim(coalesce(p_status, '')));
  v_report record;
  v_action_type text;
  v_action_id uuid;
begin
  if v_actor_role not in ('moderator', 'admin', 'ceo') then
    raise exception 'Moderator permission required';
  end if;

  if v_status not in (
    'under_review',
    'reviewed',
    'dismissed',
    'escalated',
    'ban_recommended'
  ) then
    raise exception 'Invalid moderation report status';
  end if;

  select pr.id, pr.post_id, pr.status, p.user_id as target_user_id
  into v_report
  from public.post_reports pr
  left join public.posts p
    on p.id = pr.post_id
  where pr.id = p_report_id;

  if v_report.id is null then
    raise exception 'Report not found';
  end if;

  if v_status = 'ban_recommended' and v_actor_role not in ('moderator', 'admin', 'ceo') then
    raise exception 'Moderator permission required';
  end if;

  update public.post_reports
  set status = v_status,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where id = p_report_id;

  v_action_type := case
    when v_status = 'dismissed' then 'dismiss_report'
    when v_status = 'escalated' then 'escalate_report'
    when v_status = 'ban_recommended' then 'recommend_ban'
    else 'review_report'
  end;

  insert into public.moderation_actions (
    target_user_id,
    actor_user_id,
    related_post_id,
    related_report_id,
    action_type,
    reason,
    metadata
  )
  values (
    v_report.target_user_id,
    auth.uid(),
    v_report.post_id,
    p_report_id,
    v_action_type,
    nullif(trim(coalesce(p_reason, '')), ''),
    jsonb_build_object('status', v_status)
  )
  returning id into v_action_id;

  return v_action_id;
end;
$$;


ALTER FUNCTION "public"."moderation_update_report_status"("p_report_id" "uuid", "p_status" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."moderation_update_user_role"("p_target_user_id" "uuid", "p_new_role" "text", "p_reason" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.change_user_role(p_target_user_id, p_new_role, p_reason);
$$;


ALTER FUNCTION "public"."moderation_update_user_role"("p_target_user_id" "uuid", "p_new_role" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."moderation_warn_user"("p_target_user_id" "uuid", "p_reason" "text", "p_message" "text" DEFAULT NULL::"text", "p_related_post_id" "uuid" DEFAULT NULL::"uuid", "p_related_report_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor_role text := public.get_current_moderation_actor_role();
  v_action_id uuid;
  v_event_id uuid;
  v_target record;
  v_warning_message text := nullif(trim(coalesce(p_message, '')), '');
  v_warning_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_related_post_id uuid := p_related_post_id;
  v_post_title text;
  v_post_body text;
  v_post_excerpt text;
  v_post_available boolean := false;
  v_report_reason text;
begin
  if v_actor_role not in ('moderator', 'admin', 'ceo') then
    raise exception 'Moderator permission required';
  end if;

  select * into v_target
  from public.moderation_assert_target_profile(p_target_user_id)
  limit 1;

  if v_target.id is null then
    raise exception 'Target user not found';
  end if;

  if p_target_user_id = auth.uid()
    or v_target.role in ('admin', 'ceo') then
    raise exception 'You cannot warn this user';
  end if;

  if v_actor_role = 'moderator'
    and v_target.role <> 'user' then
    raise exception 'You cannot warn this user';
  end if;

  if p_related_report_id is not null then
    select pr.post_id, nullif(trim(coalesce(pr.reason, '')), '')
    into v_related_post_id, v_report_reason
    from public.post_reports pr
    where pr.id = p_related_report_id
      and (v_related_post_id is null or pr.post_id = v_related_post_id);
  end if;

  if v_related_post_id is not null then
    select
      nullif(trim(coalesce(p.title, '')), ''),
      nullif(trim(coalesce(p.body, '')), ''),
      coalesce(p.is_deleted, false) = false and p.visibility = 'public'
    into v_post_title, v_post_body, v_post_available
    from public.posts p
    where p.id = v_related_post_id
      and p.user_id = p_target_user_id;
  end if;

  v_post_excerpt := nullif(trim(coalesce(v_post_body, '')), '');

  if v_post_excerpt is not null and char_length(v_post_excerpt) > 160 then
    v_post_excerpt := trim(left(v_post_excerpt, 160)) || '...';
  end if;

  insert into public.moderation_actions (
    target_user_id,
    actor_user_id,
    related_post_id,
    related_report_id,
    action_type,
    reason,
    message
  )
  values (
    p_target_user_id,
    auth.uid(),
    v_related_post_id,
    p_related_report_id,
    'warn',
    v_warning_reason,
    v_warning_message
  )
  returning id into v_action_id;

  insert into public.moderation_events (
    user_id,
    moderator_id,
    action,
    reason,
    expires_at
  )
  values (
    p_target_user_id,
    auth.uid(),
    'warned',
    coalesce(v_warning_message, v_warning_reason),
    null
  )
  returning id into v_event_id;

  insert into public.notifications (
    user_id,
    actor_id,
    type,
    title,
    body,
    metadata
  )
  values (
    p_target_user_id,
    null,
    'moderation_warning',
    'Moderation warning',
    'You received a warning from TriggerFeed moderation.',
    jsonb_strip_nulls(jsonb_build_object(
      'action', 'warned',
      'message', v_warning_message,
      'reason', v_warning_reason,
      'post_id', v_related_post_id,
      'post_title', v_post_title,
      'post_excerpt', v_post_excerpt,
      'post_available', v_post_available,
      'report_reason', coalesce(v_report_reason, v_warning_reason),
      'report_id', p_related_report_id,
      'moderation_action_id', v_action_id,
      'moderation_event_id', v_event_id
    ))
  );

  if p_related_report_id is not null then
    update public.post_reports
    set status = 'warned',
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        updated_at = now()
    where id = p_related_report_id;
  end if;

  return v_action_id;
end;
$$;


ALTER FUNCTION "public"."moderation_warn_user"("p_target_user_id" "uuid", "p_reason" "text", "p_message" "text", "p_related_post_id" "uuid", "p_related_report_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_invalid_comment_reply"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  parent_record record;
begin
  if new.parent_comment_id is null then
    return new;
  end if;

  select c.post_id, c.parent_comment_id, c.is_deleted
  into parent_record
  from public.comments c
  where c.id = new.parent_comment_id;

  if parent_record is null then
    raise exception 'Parent comment not found';
  end if;

  if parent_record.is_deleted = true then
    raise exception 'Cannot reply to a deleted comment';
  end if;

  if parent_record.post_id <> new.post_id then
    raise exception 'Reply parent must belong to the same post';
  end if;

  if parent_record.parent_comment_id is not null then
    raise exception 'Replies to replies are not allowed';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."prevent_invalid_comment_reply"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."repair_my_age_gate"("p_dob" "date", "p_age_gate_version" "text" DEFAULT 'v1'::"text", "p_birthday_messages_enabled" boolean DEFAULT true) RETURNS TABLE("id" "uuid", "dob" "date", "age_verified_at" timestamp with time zone, "age_gate_version" "text", "birthday_messages_enabled" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_adult_dob(p_dob) then
    raise exception 'TriggerFeed is only available to users 18 or older.';
  end if;

  return query
  update public.profiles p
  set
    dob = p_dob,
    age_verified_at = coalesce(p.age_verified_at, now()),
    age_gate_version = coalesce(nullif(trim(p_age_gate_version), ''), 'v1'),
    birthday_messages_enabled = coalesce(p_birthday_messages_enabled, true),
    updated_at = now()
  where p.id = auth.uid()
    and coalesce(p.is_deleted, false) = false
    and coalesce(p.is_banned, false) = false
  returning
    p.id,
    p.dob,
    p.age_verified_at,
    p.age_gate_version,
    p.birthday_messages_enabled;
end;
$$;


ALTER FUNCTION "public"."repair_my_age_gate"("p_dob" "date", "p_age_gate_version" "text", "p_birthday_messages_enabled" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_admin_users"("p_query" "text" DEFAULT ''::"text", "p_limit" integer DEFAULT 50) RETURNS TABLE("id" "uuid", "username" "text", "display_name" "text", "email" "text", "avatar_cloudinary_url" "text", "role" "text", "is_muted" boolean, "is_banned" boolean, "is_deleted" boolean, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_query text := lower(nullif(trim(coalesce(p_query, '')), ''));
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_can_view_email boolean := public.is_admin_or_above();
begin
  if not v_can_view_email then
    raise exception 'Admin permission required';
  end if;

  return query
  select
    p.id,
    p.username,
    p.display_name,
    case when v_can_view_email then p.email else null end as email,
    p.avatar_cloudinary_url,
    p.role,
    coalesce(p.is_muted, false) as is_muted,
    coalesce(p.is_banned, false) as is_banned,
    coalesce(p.is_deleted, false) as is_deleted,
    p.created_at
  from public.profiles p
  where
    v_query is null
    or lower(coalesce(p.username, '')) like '%' || v_query || '%'
    or lower(coalesce(p.display_name, '')) like '%' || v_query || '%'
    or lower(coalesce(p.role, '')) = v_query
    or (
      v_query in ('muted', 'mute')
      and coalesce(p.is_muted, false) = true
    )
    or (
      v_query in ('banned', 'ban')
      and coalesce(p.is_banned, false) = true
    )
    or (
      v_query in ('deleted', 'removed')
      and coalesce(p.is_deleted, false) = true
    )
    or (
      v_query in ('active', 'enabled')
      and coalesce(p.is_muted, false) = false
      and coalesce(p.is_banned, false) = false
      and coalesce(p.is_deleted, false) = false
    )
    or (
      v_can_view_email
      and lower(coalesce(p.email, '')) like '%' || v_query || '%'
    )
  order by p.created_at desc
  limit v_limit;
end;
$$;


ALTER FUNCTION "public"."search_admin_users"("p_query" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_friend_candidates"("p_query" "text", "p_limit" integer DEFAULT 25) RETURNS TABLE("id" "uuid", "username" "text", "display_name" "text", "avatar_cloudinary_url" "text", "city" "text", "state" "text", "friendship_status" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_viewer_id uuid := auth.uid();
  v_query text := lower(trim(regexp_replace(coalesce(p_query, ''), '^@+', '')));
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 50);
begin
  if v_viewer_id is null then
    raise exception 'Authentication required';
  end if;

  if v_query = '' then
    return;
  end if;

  return query
  with candidates as (
    select
      p.id,
      p.username,
      p.display_name,
      p.avatar_cloudinary_url,
      case
        when lower(p.privacy_settings #>> '{profile_visibility,show_city}') in ('true', 'false')
          and (p.privacy_settings #>> '{profile_visibility,show_city}')::boolean
          then p.city
        else null
      end as city,
      case
        when lower(p.privacy_settings #>> '{profile_visibility,show_state}') in ('true', 'false')
          and (p.privacy_settings #>> '{profile_visibility,show_state}')::boolean
          then p.state
        else null
      end as state,
      relationship.status as friendship_status,
      case
        when starts_with(lower(coalesce(p.username, '')), v_query)
          or starts_with(lower(coalesce(p.display_name, '')), v_query)
          or starts_with(lower(coalesce(p.first_name, '')), v_query)
          or starts_with(lower(coalesce(p.last_name, '')), v_query)
          or starts_with(lower(
            concat_ws(
              ' ',
              nullif(trim(p.first_name), ''),
              nullif(trim(p.last_name), '')
            )
          ), v_query)
          then 0
        else 1
      end as match_rank
    from public.profiles p
    left join lateral (
      select f.status
      from public.friends f
      where
        (f.requester_id = v_viewer_id and f.addressee_id = p.id)
        or
        (f.requester_id = p.id and f.addressee_id = v_viewer_id)
      order by
        case f.status
          when 'accepted' then 0
          when 'pending' then 1
          when 'blocked' then 2
          else 3
        end,
        f.updated_at desc
      limit 1
    ) relationship on true
    where p.id <> v_viewer_id
      and coalesce(p.is_deleted, false) = false
      and coalesce(p.is_banned, false) = false
      and (
        strpos(lower(coalesce(p.username, '')), v_query) > 0
        or strpos(lower(coalesce(p.display_name, '')), v_query) > 0
        or strpos(lower(coalesce(p.first_name, '')), v_query) > 0
        or strpos(lower(coalesce(p.last_name, '')), v_query) > 0
        or strpos(lower(
          concat_ws(
            ' ',
            nullif(trim(p.first_name), ''),
            nullif(trim(p.last_name), '')
          )
        ), v_query) > 0
      )
  )
  select
    c.id,
    c.username,
    c.display_name,
    c.avatar_cloudinary_url,
    c.city,
    c.state,
    c.friendship_status
  from candidates c
  order by
    c.match_rank,
    lower(coalesce(c.username, '')),
    lower(coalesce(c.display_name, '')),
    c.id
  limit v_limit;
end;
$$;


ALTER FUNCTION "public"."search_friend_candidates"("p_query" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_friends_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_friends_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_post_reports_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_post_reports_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_post_votes_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_post_votes_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_profile_showcase_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_profile_showcase_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_profiles_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_profiles_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_profiles_username_lower"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if new.username is not null then
    new.username_lower = lower(new.username);
  else
    new.username_lower = null;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."set_profiles_username_lower"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."should_create_notification"("p_user_id" "uuid", "p_type" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select case p_type
    when 'mention' then coalesce((
      select ns.mentions_enabled
      from public.notification_settings ns
      where ns.user_id = p_user_id
    ), true)
    when 'comment' then coalesce((
      select ns.comments_enabled
      from public.notification_settings ns
      where ns.user_id = p_user_id
    ), true)
    when 'reply' then coalesce((
      select ns.comments_enabled
      from public.notification_settings ns
      where ns.user_id = p_user_id
    ), true)
    when 'friend_request' then coalesce((
      select ns.friend_requests_enabled
      from public.notification_settings ns
      where ns.user_id = p_user_id
    ), true)
    when 'friend_accepted' then coalesce((
      select ns.friend_accepts_enabled
      from public.notification_settings ns
      where ns.user_id = p_user_id
    ), true)
    when 'moderation_warning' then true
    when 'account_muted' then true
    when 'account_banned' then true
    when 'account_unmuted' then true
    when 'account_unbanned' then true
    else true
  end;
$$;


ALTER FUNCTION "public"."should_create_notification"("p_user_id" "uuid", "p_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."soft_delete_comment"("target_comment_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  deleted_comment_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  perform public.assert_current_user_can_interact();

  update public.comments
  set
    body = '[deleted]',
    is_deleted = true,
    deleted_at = now(),
    updated_at = now()
  where id = target_comment_id
    and user_id = auth.uid()
    and is_deleted = false
  returning id into deleted_comment_id;

  if deleted_comment_id is null then
    raise exception 'Comment not found or you do not have permission to delete it';
  end if;

  return deleted_comment_id;
end;
$$;


ALTER FUNCTION "public"."soft_delete_comment"("target_comment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."soft_delete_comment_thread"("target_comment_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  target_comment record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  perform public.assert_current_user_can_interact();

  select c.id, c.post_id, c.user_id, c.is_deleted
  into target_comment
  from public.comments c
  where c.id = target_comment_id;

  if target_comment is null then
    raise exception 'Comment not found';
  end if;

  if target_comment.user_id <> auth.uid() then
    raise exception 'You do not have permission to delete this comment';
  end if;

  if target_comment.is_deleted = true then
    raise exception 'Comment is already deleted';
  end if;

  update public.comments
  set
    body = '[deleted]',
    is_deleted = true,
    deleted_at = now(),
    updated_at = now()
  where post_id = target_comment.post_id
    and is_deleted = false
    and (
      id = target_comment.id
      or parent_comment_id = target_comment.id
    );

  return target_comment.id;
end;
$$;


ALTER FUNCTION "public"."soft_delete_comment_thread"("target_comment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."soft_delete_my_account"() RETURNS TABLE("id" "uuid", "is_deleted" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  return query
  update public.profiles p
  set
    is_deleted = true,
    display_name = 'Deleted User',
    bio = null,
    avatar_cloudinary_url = null,
    avatar_cloudinary_public_id = null,
    banner_cloudinary_url = null,
    banner_cloudinary_public_id = null,
    city = null,
    state = null,
    privacy_settings = coalesce(
      p.privacy_settings,
      jsonb_build_object(
        'profile_visibility',
        jsonb_build_object(
          'show_email', false,
          'show_city', false,
          'show_state', false,
          'show_real_name', false,
          'show_age', false
        )
      )
    ),
    updated_at = now()
  where p.id = auth.uid()
    and coalesce(p.is_deleted, false) = false
  returning p.id, p.is_deleted;
end;
$$;


ALTER FUNCTION "public"."soft_delete_my_account"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."soft_delete_post"("target_post_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  deleted_post_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  perform public.assert_current_user_can_interact();

  update public.posts
  set
    is_deleted = true,
    deleted_at = now(),
    updated_at = now()
  where id = target_post_id
    and user_id = auth.uid()
    and is_deleted = false
  returning id into deleted_post_id;

  if deleted_post_id is null then
    raise exception 'Post not found or you do not have permission to delete it';
  end if;

  return deleted_post_id;
end;
$$;


ALTER FUNCTION "public"."soft_delete_post"("target_post_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_post_vote"("target_post_id" "uuid", "target_vote_type" "text") RETURNS TABLE("post_id" "uuid", "user_vote" "text", "score" integer, "vote_score" integer, "vote_count" integer, "upvote_count" integer, "downvote_count" integer, "interaction_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  existing_vote_type text;
begin
  perform public.assert_current_user_can_interact();

  if target_vote_type not in ('upvote', 'downvote') then
    raise exception 'Vote type must be upvote or downvote';
  end if;

  if not exists (
    select 1
    from public.posts p
    where p.id = target_post_id
      and p.is_deleted = false
      and p.visibility = 'public'
  ) then
    raise exception 'Post not found or not votable';
  end if;

  select pv.vote_type
  into existing_vote_type
  from public.post_votes pv
  where pv.post_id = target_post_id
    and pv.user_id = auth.uid();

  if existing_vote_type = target_vote_type then
    delete from public.post_votes pv
    where pv.post_id = target_post_id
      and pv.user_id = auth.uid();

  elsif existing_vote_type is null then
    insert into public.post_votes (post_id, user_id, vote_type)
    values (target_post_id, auth.uid(), target_vote_type);

  else
    update public.post_votes pv
    set vote_type = target_vote_type
    where pv.post_id = target_post_id
      and pv.user_id = auth.uid();
  end if;

  return query
  select
    pvc.post_id,
    (
      select pv.vote_type
      from public.post_votes pv
      where pv.post_id = target_post_id
        and pv.user_id = auth.uid()
    ) as user_vote,
    pvc.score,
    pvc.vote_score,
    pvc.vote_count,
    pvc.upvote_count,
    pvc.downvote_count,
    pvc.interaction_count
  from public.post_vote_counts pvc
  where pvc.post_id = target_post_id;
end;
$$;


ALTER FUNCTION "public"."toggle_post_vote"("target_post_id" "uuid", "target_vote_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_post_transactional"("p_post_id" "uuid", "p_title" "text", "p_body" "text", "p_visibility" "text", "p_is_sticky" boolean DEFAULT false, "p_gif" "jsonb" DEFAULT NULL::"jsonb", "p_remove_gif" boolean DEFAULT false, "p_poll" "jsonb" DEFAULT NULL::"jsonb", "p_remove_poll" boolean DEFAULT false) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_poll_id uuid;
  v_response_count integer;
  v_option text;
  v_option_index integer := 0;
  v_role text;
  v_existing_gif_id uuid;
  v_sort_order integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  perform public.assert_current_user_can_interact();

  select p.role into v_role
  from public.profiles p
  where p.id = auth.uid();

  update public.posts p
  set
    title = nullif(trim(coalesce(p_title, '')), ''),
    body = nullif(trim(coalesce(p_body, '')), ''),
    visibility = coalesce(nullif(trim(coalesce(p_visibility, '')), ''), 'public'),
    is_sticky = coalesce(v_role = 'ceo' and p_is_sticky, false),
    updated_at = now()
  where p.id = p_post_id
    and p.user_id = auth.uid()
    and p.is_deleted = false;

  if not found then
    raise exception 'Post not found or you do not have permission to edit it';
  end if;

  if p_remove_gif then
    delete from public.post_media pm
    where pm.post_id = p_post_id
      and pm.user_id = auth.uid()
      and pm.media_type = 'gif';
  end if;

  if p_gif is not null then
    select pm.id, coalesce(pm.display_order, pm.sort_order, 0)
    into v_existing_gif_id, v_sort_order
    from public.post_media pm
    where pm.post_id = p_post_id
      and pm.user_id = auth.uid()
      and pm.media_type = 'gif'
    order by pm.display_order asc, pm.created_at asc
    limit 1;

    if v_existing_gif_id is null then
      select coalesce(max(coalesce(pm.display_order, pm.sort_order, 0)) + 1, 0)
      into v_sort_order
      from public.post_media pm
      where pm.post_id = p_post_id
        and pm.user_id = auth.uid();

      insert into public.post_media (
        post_id,
        user_id,
        media_type,
        provider,
        source,
        external_id,
        external_url,
        thumbnail_url,
        title,
        sort_order,
        display_order
      )
      values (
        p_post_id,
        auth.uid(),
        'gif',
        'giphy',
        'giphy',
        nullif(p_gif->>'external_id', ''),
        p_gif->>'external_url',
        nullif(p_gif->>'thumbnail_url', ''),
        nullif(p_gif->>'title', ''),
        v_sort_order,
        v_sort_order
      );
    else
      update public.post_media pm
      set
        provider = 'giphy',
        source = 'giphy',
        external_id = nullif(p_gif->>'external_id', ''),
        external_url = p_gif->>'external_url',
        thumbnail_url = nullif(p_gif->>'thumbnail_url', ''),
        title = nullif(p_gif->>'title', ''),
        sort_order = v_sort_order,
        display_order = v_sort_order
      where pm.id = v_existing_gif_id
        and pm.post_id = p_post_id
        and pm.user_id = auth.uid();
    end if;

    delete from public.post_media pm
    where pm.post_id = p_post_id
      and pm.user_id = auth.uid()
      and pm.media_type = 'gif'
      and pm.id <> coalesce(v_existing_gif_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and v_existing_gif_id is not null;
  end if;

  select poll.id
  into v_poll_id
  from public.polls poll
  where poll.post_id = p_post_id
  limit 1;

  if p_remove_poll and v_poll_id is not null then
    select count(*)::integer
    into v_response_count
    from public.poll_responses pr
    where pr.poll_id = v_poll_id;

    if v_response_count > 0 then
      raise exception 'This poll already has votes, so it cannot be removed.';
    end if;

    delete from public.poll_options po where po.poll_id = v_poll_id;
    delete from public.polls poll where poll.id = v_poll_id and poll.post_id = p_post_id;
    v_poll_id := null;
  end if;

  if p_poll is not null then
    if v_poll_id is null then
      insert into public.polls (
        post_id,
        question,
        allows_multiple
      )
      values (
        p_post_id,
        p_poll->>'question',
        coalesce((p_poll->>'allows_multiple')::boolean, false)
      )
      returning id into v_poll_id;
    else
      select count(*)::integer
      into v_response_count
      from public.poll_responses pr
      where pr.poll_id = v_poll_id;

      if v_response_count > 0 then
        raise exception 'This poll already has votes, so its options cannot be changed.';
      end if;

      update public.polls poll
      set
        question = p_poll->>'question',
        allows_multiple = coalesce((p_poll->>'allows_multiple')::boolean, false),
        updated_at = now()
      where poll.id = v_poll_id
        and poll.post_id = p_post_id;

      delete from public.poll_options po where po.poll_id = v_poll_id;
    end if;

    for v_option in
      select jsonb_array_elements_text(coalesce(p_poll->'options', '[]'::jsonb))
    loop
      insert into public.poll_options (
        poll_id,
        option_text,
        display_order
      )
      values (
        v_poll_id,
        v_option,
        v_option_index
      );

      v_option_index := v_option_index + 1;
    end loop;
  end if;

  return p_post_id;
end;
$$;


ALTER FUNCTION "public"."update_post_transactional"("p_post_id" "uuid", "p_title" "text", "p_body" "text", "p_visibility" "text", "p_is_sticky" boolean, "p_gif" "jsonb", "p_remove_gif" boolean, "p_poll" "jsonb", "p_remove_poll" boolean) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."abuse_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "link" "text" NOT NULL,
    "offending_username" "text",
    "details" "text" NOT NULL,
    "source" "text" DEFAULT 'triggerfeed-v3-legal'::"text" NOT NULL,
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "abuse_reports_details_length_check" CHECK ((("char_length"("details") >= 10) AND ("char_length"("details") <= 4000))),
    CONSTRAINT "abuse_reports_email_length_check" CHECK (("char_length"("email") <= 254)),
    CONSTRAINT "abuse_reports_link_length_check" CHECK (("char_length"("link") <= 2048)),
    CONSTRAINT "abuse_reports_offending_username_length_check" CHECK ((("offending_username" IS NULL) OR ("char_length"("offending_username") <= 80))),
    CONSTRAINT "abuse_reports_source_length_check" CHECK (("char_length"("source") <= 120)),
    CONSTRAINT "abuse_reports_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'reviewing'::"text", 'reviewed'::"text", 'dismissed'::"text", 'action_taken'::"text", 'pending'::"text", 'under_review'::"text"])))
);


ALTER TABLE "public"."abuse_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."auth_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "email" "text",
    "event_type" "text" NOT NULL,
    "success" boolean DEFAULT true NOT NULL,
    "error_code" "text",
    "error_message" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "auth_events_event_type_not_blank_check" CHECK (("char_length"(TRIM(BOTH FROM "event_type")) > 0))
);


ALTER TABLE "public"."auth_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "parent_comment_id" "uuid",
    "body" "text" NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "comments_body_length_check" CHECK (("char_length"("body") <= 5000)),
    CONSTRAINT "comments_body_not_blank_check" CHECK (("char_length"(TRIM(BOTH FROM "body")) > 0)),
    CONSTRAINT "comments_deleted_at_check" CHECK (((("is_deleted" = false) AND ("deleted_at" IS NULL)) OR (("is_deleted" = true) AND ("deleted_at" IS NOT NULL)))),
    CONSTRAINT "comments_no_self_reply" CHECK ((("parent_comment_id" IS NULL) OR ("parent_comment_id" <> "id")))
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."friends" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "requester_id" "uuid" NOT NULL,
    "addressee_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "friends_no_self_request" CHECK (("requester_id" <> "addressee_id")),
    CONSTRAINT "friends_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text", 'blocked'::"text"])))
);


ALTER TABLE "public"."friends" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."moderation_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "target_user_id" "uuid",
    "actor_user_id" "uuid",
    "related_post_id" "uuid",
    "related_report_id" "uuid",
    "action_type" "text" NOT NULL,
    "reason" "text",
    "message" "text",
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "moderation_actions_action_type_check" CHECK (("action_type" = ANY (ARRAY['warn'::"text", 'mute'::"text", 'unmute'::"text", 'ban'::"text", 'unban'::"text", 'remove_post'::"text", 'restore_post'::"text", 'dismiss_report'::"text", 'review_report'::"text", 'escalate_report'::"text", 'recommend_ban'::"text", 'admin_note'::"text", 'promote_user'::"text", 'demote_user'::"text", 'role_changed'::"text"]))),
    CONSTRAINT "moderation_actions_target_or_related_required_check" CHECK ((("target_user_id" IS NOT NULL) OR ("related_post_id" IS NOT NULL) OR ("related_report_id" IS NOT NULL)))
);


ALTER TABLE "public"."moderation_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."moderation_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "moderator_id" "uuid",
    "action" "text" NOT NULL,
    "reason" "text",
    "expires_at" timestamp with time zone,
    "email_sent_at" timestamp with time zone,
    "email_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "moderation_events_action_check" CHECK (("action" = ANY (ARRAY['muted'::"text", 'unmuted'::"text", 'banned'::"text", 'unbanned'::"text", 'warned'::"text"])))
);


ALTER TABLE "public"."moderation_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_settings" (
    "user_id" "uuid" NOT NULL,
    "mentions_enabled" boolean DEFAULT true NOT NULL,
    "comments_enabled" boolean DEFAULT true NOT NULL,
    "friend_requests_enabled" boolean DEFAULT true NOT NULL,
    "friend_accepts_enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notification_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "type" "text" NOT NULL,
    "post_id" "uuid",
    "comment_id" "uuid",
    "friend_id" "uuid",
    "title" "text",
    "body" "text",
    "is_read" boolean DEFAULT false NOT NULL,
    "read_at" timestamp with time zone,
    "dismissed_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['mention'::"text", 'comment'::"text", 'reply'::"text", 'friend_request'::"text", 'friend_accepted'::"text", 'moderation_warning'::"text", 'account_muted'::"text", 'account_banned'::"text", 'account_unmuted'::"text", 'account_unbanned'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."poll_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "poll_id" "uuid" NOT NULL,
    "option_text" "text" NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "poll_options_display_order_check" CHECK (("display_order" >= 0)),
    CONSTRAINT "poll_options_text_length" CHECK ((("char_length"(TRIM(BOTH FROM "option_text")) >= 1) AND ("char_length"(TRIM(BOTH FROM "option_text")) <= 120)))
);


ALTER TABLE "public"."poll_options" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."poll_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "poll_id" "uuid" NOT NULL,
    "option_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."poll_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."polls" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "question" "text" NOT NULL,
    "allows_multiple" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "polls_question_length" CHECK ((("char_length"(TRIM(BOTH FROM "question")) >= 1) AND ("char_length"(TRIM(BOTH FROM "question")) <= 180)))
);


ALTER TABLE "public"."polls" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "success" boolean NOT NULL,
    "error_code" "text",
    "error_message" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "post_audit_logs_event_type_not_blank_check" CHECK (("char_length"(TRIM(BOTH FROM "event_type")) > 0))
);


ALTER TABLE "public"."post_audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_media" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "media_type" "text" DEFAULT 'image'::"text" NOT NULL,
    "provider" "text" DEFAULT 'cloudinary'::"text" NOT NULL,
    "source" "text",
    "cloudinary_url" "text",
    "cloudinary_secure_url" "text",
    "cloudinary_public_id" "text",
    "external_id" "text",
    "external_url" "text",
    "thumbnail_url" "text",
    "title" "text",
    "original_filename" "text",
    "mime_type" "text",
    "file_size_bytes" integer,
    "width" integer,
    "height" integer,
    "format" "text",
    "alt_text" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "post_media_dimensions_check" CHECK (((("width" IS NULL) OR ("width" > 0)) AND (("height" IS NULL) OR ("height" > 0)))),
    CONSTRAINT "post_media_display_order_check" CHECK (("display_order" >= 0)),
    CONSTRAINT "post_media_file_size_check" CHECK ((("file_size_bytes" IS NULL) OR ("file_size_bytes" >= 0))),
    CONSTRAINT "post_media_has_valid_media_source" CHECK (((("provider" = 'cloudinary'::"text") AND ("media_type" = ANY (ARRAY['image'::"text", 'video'::"text"])) AND ("cloudinary_url" IS NOT NULL) AND ("cloudinary_public_id" IS NOT NULL)) OR (("provider" = 'giphy'::"text") AND ("media_type" = 'gif'::"text") AND ("external_url" IS NOT NULL)))),
    CONSTRAINT "post_media_media_type_check" CHECK (("media_type" = ANY (ARRAY['image'::"text", 'video'::"text", 'gif'::"text"]))),
    CONSTRAINT "post_media_provider_check" CHECK (("provider" = ANY (ARRAY['cloudinary'::"text", 'giphy'::"text"]))),
    CONSTRAINT "post_media_sort_order_check" CHECK (("sort_order" >= 0))
);


ALTER TABLE "public"."post_media" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "details" "text",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "post_reports_details_length_check" CHECK ((("details" IS NULL) OR ("char_length"("details") <= 1000))),
    CONSTRAINT "post_reports_reason_check" CHECK (("reason" = ANY (ARRAY['spam'::"text", 'harassment'::"text", 'threats'::"text", 'illegal_content'::"text", 'graphic_content'::"text", 'scam'::"text", 'other'::"text"]))),
    CONSTRAINT "post_reports_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'reviewed'::"text", 'dismissed'::"text", 'actioned'::"text", 'pending'::"text", 'under_review'::"text", 'warned'::"text", 'post_removed'::"text", 'escalated'::"text", 'muted'::"text", 'ban_recommended'::"text", 'banned'::"text"])))
);


ALTER TABLE "public"."post_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "vote_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "post_votes_vote_type_check" CHECK (("vote_type" = ANY (ARRAY['upvote'::"text", 'downvote'::"text"])))
);


ALTER TABLE "public"."post_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text",
    "body" "text",
    "visibility" "text" DEFAULT 'public'::"text" NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_sticky" boolean DEFAULT false NOT NULL,
    "sticky_at" timestamp with time zone,
    "sticky_by" "uuid",
    "removed_at" timestamp with time zone,
    "removed_by" "uuid",
    "removal_reason" "text",
    "restored_at" timestamp with time zone,
    "restored_by" "uuid",
    CONSTRAINT "posts_body_length_check" CHECK ((("body" IS NULL) OR ("char_length"("body") <= 5000))),
    CONSTRAINT "posts_deleted_at_check" CHECK (((("is_deleted" = false) AND ("deleted_at" IS NULL)) OR (("is_deleted" = true) AND ("deleted_at" IS NOT NULL)))),
    CONSTRAINT "posts_sticky_metadata_check" CHECK (((("is_sticky" = true) AND ("sticky_at" IS NOT NULL) AND ("sticky_by" IS NOT NULL)) OR (("is_sticky" = false) AND ("sticky_at" IS NULL) AND ("sticky_by" IS NULL)))),
    CONSTRAINT "posts_title_length_check" CHECK ((("title" IS NULL) OR ("char_length"("title") <= 120))),
    CONSTRAINT "posts_title_or_body_required_check" CHECK (((NULLIF(TRIM(BOTH FROM COALESCE("title", ''::"text")), ''::"text") IS NOT NULL) OR (NULLIF(TRIM(BOTH FROM COALESCE("body", ''::"text")), ''::"text") IS NOT NULL))),
    CONSTRAINT "posts_visibility_check" CHECK (("visibility" = ANY (ARRAY['public'::"text", 'friends'::"text", 'private'::"text"])))
);


ALTER TABLE "public"."posts" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."post_vote_counts" AS
 SELECT "p"."id" AS "post_id",
    ("count"("pv"."vote_type") FILTER (WHERE ("pv"."vote_type" = 'upvote'::"text")))::integer AS "upvote_count",
    ("count"("pv"."vote_type") FILTER (WHERE ("pv"."vote_type" = 'downvote'::"text")))::integer AS "downvote_count",
    (("count"("pv"."vote_type") FILTER (WHERE ("pv"."vote_type" = 'upvote'::"text")) - "count"("pv"."vote_type") FILTER (WHERE ("pv"."vote_type" = 'downvote'::"text"))))::integer AS "score",
    (("count"("pv"."vote_type") FILTER (WHERE ("pv"."vote_type" = 'upvote'::"text")) - "count"("pv"."vote_type") FILTER (WHERE ("pv"."vote_type" = 'downvote'::"text"))))::integer AS "vote_score",
    ("count"("pv"."vote_type"))::integer AS "vote_count",
    ("count"("pv"."vote_type"))::integer AS "interaction_count"
   FROM ("public"."posts" "p"
     LEFT JOIN "public"."post_votes" "pv" ON (("pv"."post_id" = "p"."id")))
  WHERE (("p"."is_deleted" = false) AND ("p"."visibility" = 'public'::"text"))
  GROUP BY "p"."id";


ALTER VIEW "public"."post_vote_counts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_top_friends" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "friend_user_id" "uuid" NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profile_top_friends_display_order_check" CHECK (("display_order" >= 0)),
    CONSTRAINT "profile_top_friends_no_self" CHECK (("user_id" <> "friend_user_id"))
);


ALTER TABLE "public"."profile_top_friends" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_top_guns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "image_cloudinary_url" "text",
    "image_cloudinary_public_id" "text",
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "image_cloudinary_secure_url" "text",
    "image_width" integer,
    "image_height" integer,
    CONSTRAINT "profile_top_guns_description_length_check" CHECK ((("description" IS NULL) OR ("char_length"("description") <= 500))),
    CONSTRAINT "profile_top_guns_display_order_check" CHECK (("display_order" >= 0)),
    CONSTRAINT "profile_top_guns_image_height_check" CHECK ((("image_height" IS NULL) OR ("image_height" > 0))),
    CONSTRAINT "profile_top_guns_image_secure_url_check" CHECK ((("image_cloudinary_secure_url" IS NULL) OR ("image_cloudinary_secure_url" ~~ 'https://res.cloudinary.com/triggerfeed/%'::"text"))),
    CONSTRAINT "profile_top_guns_image_url_check" CHECK ((("image_cloudinary_url" IS NULL) OR ("image_cloudinary_url" ~~ 'https://res.cloudinary.com/triggerfeed/%'::"text"))),
    CONSTRAINT "profile_top_guns_image_width_check" CHECK ((("image_width" IS NULL) OR ("image_width" > 0))),
    CONSTRAINT "profile_top_guns_name_length_check" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 1) AND ("char_length"(TRIM(BOTH FROM "name")) <= 120)))
);


ALTER TABLE "public"."profile_top_guns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "username" "text",
    "username_lower" "text",
    "display_name" "text",
    "first_name" "text",
    "last_name" "text",
    "city" "text",
    "state" "text",
    "bio" "text",
    "dob" "date",
    "age_verified_at" timestamp with time zone,
    "age_gate_version" "text" DEFAULT 'v1'::"text" NOT NULL,
    "birthday_messages_enabled" boolean DEFAULT true NOT NULL,
    "avatar_cloudinary_url" "text",
    "avatar_cloudinary_public_id" "text",
    "banner_cloudinary_url" "text",
    "banner_cloudinary_public_id" "text",
    "role" "text" DEFAULT 'user'::"text" NOT NULL,
    "profile_badge" "text",
    "is_banned" boolean DEFAULT false NOT NULL,
    "is_muted" boolean DEFAULT false NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "privacy_settings" "jsonb" DEFAULT '{"profile_visibility": {"show_age": false, "show_city": false, "show_email": false, "show_state": false, "show_real_name": false}}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_rank_key" "text",
    "last_seen_rank_at" timestamp with time zone,
    CONSTRAINT "profiles_bio_length_check" CHECK ((("bio" IS NULL) OR ("char_length"("bio") <= 500))),
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'moderator'::"text", 'admin'::"text", 'ceo'::"text"]))),
    CONSTRAINT "profiles_username_format_check" CHECK ((("username" IS NULL) OR ("username" ~ '^[A-Za-z0-9_-]+$'::"text"))),
    CONSTRAINT "profiles_username_length_check" CHECK ((("username" IS NULL) OR (("char_length"("username") >= 3) AND ("char_length"("username") <= 32))))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_rank_thresholds" (
    "key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "min_posts" integer NOT NULL,
    "sort_order" integer NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_rank_thresholds_min_posts_check" CHECK (("min_posts" >= 0))
);


ALTER TABLE "public"."user_rank_thresholds" OWNER TO "postgres";


ALTER TABLE ONLY "public"."abuse_reports"
    ADD CONSTRAINT "abuse_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auth_events"
    ADD CONSTRAINT "auth_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."friends"
    ADD CONSTRAINT "friends_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."friends"
    ADD CONSTRAINT "friends_unique_pair" UNIQUE ("requester_id", "addressee_id");



ALTER TABLE ONLY "public"."moderation_actions"
    ADD CONSTRAINT "moderation_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."moderation_events"
    ADD CONSTRAINT "moderation_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_settings"
    ADD CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."poll_options"
    ADD CONSTRAINT "poll_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."poll_responses"
    ADD CONSTRAINT "poll_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."poll_responses"
    ADD CONSTRAINT "poll_responses_unique_poll_user" UNIQUE ("poll_id", "user_id");



ALTER TABLE ONLY "public"."polls"
    ADD CONSTRAINT "polls_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_audit_logs"
    ADD CONSTRAINT "post_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_media"
    ADD CONSTRAINT "post_media_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_reports"
    ADD CONSTRAINT "post_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_reports"
    ADD CONSTRAINT "post_reports_unique_post_reporter" UNIQUE ("post_id", "reporter_id");



ALTER TABLE ONLY "public"."post_votes"
    ADD CONSTRAINT "post_votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_votes"
    ADD CONSTRAINT "post_votes_unique_user_post" UNIQUE ("post_id", "user_id");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_top_friends"
    ADD CONSTRAINT "profile_top_friends_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_top_friends"
    ADD CONSTRAINT "profile_top_friends_unique_friend" UNIQUE ("user_id", "friend_user_id");



ALTER TABLE ONLY "public"."profile_top_friends"
    ADD CONSTRAINT "profile_top_friends_unique_order" UNIQUE ("user_id", "display_order");



ALTER TABLE ONLY "public"."profile_top_guns"
    ADD CONSTRAINT "profile_top_guns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_top_guns"
    ADD CONSTRAINT "profile_top_guns_unique_order" UNIQUE ("user_id", "display_order");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_lower_key" UNIQUE ("username_lower");



ALTER TABLE ONLY "public"."user_rank_thresholds"
    ADD CONSTRAINT "user_rank_thresholds_pkey" PRIMARY KEY ("key");



CREATE INDEX "abuse_reports_created_at_idx" ON "public"."abuse_reports" USING "btree" ("created_at" DESC);



CREATE INDEX "abuse_reports_lower_email_idx" ON "public"."abuse_reports" USING "btree" ("lower"("email"));



CREATE INDEX "abuse_reports_offending_username_idx" ON "public"."abuse_reports" USING "btree" ("offending_username") WHERE ("offending_username" IS NOT NULL);



CREATE INDEX "abuse_reports_reviewed_by_idx" ON "public"."abuse_reports" USING "btree" ("reviewed_by");



CREATE INDEX "abuse_reports_status_idx" ON "public"."abuse_reports" USING "btree" ("status");



CREATE INDEX "auth_events_created_at_idx" ON "public"."auth_events" USING "btree" ("created_at" DESC);



CREATE INDEX "auth_events_email_idx" ON "public"."auth_events" USING "btree" ("email");



CREATE INDEX "auth_events_event_type_idx" ON "public"."auth_events" USING "btree" ("event_type");



CREATE INDEX "auth_events_user_id_idx" ON "public"."auth_events" USING "btree" ("user_id");



CREATE INDEX "comments_parent_comment_id_idx" ON "public"."comments" USING "btree" ("parent_comment_id");



CREATE INDEX "comments_post_id_parent_comment_id_idx" ON "public"."comments" USING "btree" ("post_id", "parent_comment_id");



CREATE INDEX "comments_user_id_idx" ON "public"."comments" USING "btree" ("user_id");



CREATE INDEX "comments_visible_by_post_created_at_idx" ON "public"."comments" USING "btree" ("post_id", "created_at") WHERE ("is_deleted" = false);



CREATE INDEX "friends_addressee_id_idx" ON "public"."friends" USING "btree" ("addressee_id");



CREATE INDEX "friends_requester_addressee_status_idx" ON "public"."friends" USING "btree" ("requester_id", "addressee_id", "status");



CREATE INDEX "friends_requester_id_idx" ON "public"."friends" USING "btree" ("requester_id");



CREATE INDEX "friends_status_idx" ON "public"."friends" USING "btree" ("status");



CREATE UNIQUE INDEX "friends_unique_profile_pair" ON "public"."friends" USING "btree" (LEAST("requester_id", "addressee_id"), GREATEST("requester_id", "addressee_id"));



CREATE INDEX "moderation_actions_action_type_idx" ON "public"."moderation_actions" USING "btree" ("action_type");



CREATE INDEX "moderation_actions_actor_user_id_idx" ON "public"."moderation_actions" USING "btree" ("actor_user_id");



CREATE INDEX "moderation_actions_created_at_idx" ON "public"."moderation_actions" USING "btree" ("created_at" DESC);



CREATE INDEX "moderation_actions_related_post_id_idx" ON "public"."moderation_actions" USING "btree" ("related_post_id");



CREATE INDEX "moderation_actions_related_report_id_idx" ON "public"."moderation_actions" USING "btree" ("related_report_id");



CREATE INDEX "moderation_actions_target_user_id_idx" ON "public"."moderation_actions" USING "btree" ("target_user_id");



CREATE INDEX "moderation_events_action_idx" ON "public"."moderation_events" USING "btree" ("action");



CREATE INDEX "moderation_events_created_at_idx" ON "public"."moderation_events" USING "btree" ("created_at" DESC);



CREATE INDEX "moderation_events_moderator_id_idx" ON "public"."moderation_events" USING "btree" ("moderator_id");



CREATE INDEX "moderation_events_user_id_idx" ON "public"."moderation_events" USING "btree" ("user_id");



CREATE INDEX "notifications_actor_id_idx" ON "public"."notifications" USING "btree" ("actor_id");



CREATE INDEX "notifications_comment_id_idx" ON "public"."notifications" USING "btree" ("comment_id");



CREATE INDEX "notifications_post_id_idx" ON "public"."notifications" USING "btree" ("post_id");



CREATE UNIQUE INDEX "notifications_unique_comment_context_idx" ON "public"."notifications" USING "btree" ("user_id", "actor_id", "type", "comment_id") WHERE (("type" = ANY (ARRAY['comment'::"text", 'reply'::"text"])) AND ("comment_id" IS NOT NULL));



CREATE UNIQUE INDEX "notifications_unique_friend_context_idx" ON "public"."notifications" USING "btree" ("user_id", "actor_id", "type", "friend_id") WHERE (("type" = ANY (ARRAY['friend_request'::"text", 'friend_accepted'::"text"])) AND ("friend_id" IS NOT NULL));



CREATE UNIQUE INDEX "notifications_unique_mention_context_idx" ON "public"."notifications" USING "btree" ("user_id", "actor_id", "type", "post_id", COALESCE("comment_id", '00000000-0000-0000-0000-000000000000'::"uuid")) WHERE ("type" = 'mention'::"text");



CREATE INDEX "notifications_user_id_idx" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "notifications_user_id_is_read_created_at_idx" ON "public"."notifications" USING "btree" ("user_id", "is_read", "created_at" DESC);



CREATE INDEX "poll_options_poll_id_display_order_idx" ON "public"."poll_options" USING "btree" ("poll_id", "display_order");



CREATE INDEX "poll_responses_option_id_idx" ON "public"."poll_responses" USING "btree" ("option_id");



CREATE INDEX "poll_responses_poll_id_idx" ON "public"."poll_responses" USING "btree" ("poll_id");



CREATE INDEX "poll_responses_user_id_idx" ON "public"."poll_responses" USING "btree" ("user_id");



CREATE INDEX "polls_post_id_idx" ON "public"."polls" USING "btree" ("post_id");



CREATE INDEX "post_audit_logs_created_at_idx" ON "public"."post_audit_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "post_audit_logs_event_type_idx" ON "public"."post_audit_logs" USING "btree" ("event_type");



CREATE INDEX "post_audit_logs_post_id_idx" ON "public"."post_audit_logs" USING "btree" ("post_id");



CREATE INDEX "post_audit_logs_user_id_idx" ON "public"."post_audit_logs" USING "btree" ("user_id");



CREATE INDEX "post_media_external_id_idx" ON "public"."post_media" USING "btree" ("external_id");



CREATE INDEX "post_media_media_type_idx" ON "public"."post_media" USING "btree" ("media_type");



CREATE INDEX "post_media_post_id_idx" ON "public"."post_media" USING "btree" ("post_id");



CREATE INDEX "post_media_post_sort_idx" ON "public"."post_media" USING "btree" ("post_id", "sort_order");



CREATE INDEX "post_media_provider_idx" ON "public"."post_media" USING "btree" ("provider");



CREATE INDEX "post_media_user_id_idx" ON "public"."post_media" USING "btree" ("user_id");



CREATE INDEX "post_reports_created_at_idx" ON "public"."post_reports" USING "btree" ("created_at" DESC);



CREATE INDEX "post_reports_post_id_idx" ON "public"."post_reports" USING "btree" ("post_id");



CREATE INDEX "post_reports_post_status_idx" ON "public"."post_reports" USING "btree" ("post_id", "status");



CREATE INDEX "post_reports_reporter_id_idx" ON "public"."post_reports" USING "btree" ("reporter_id");



CREATE INDEX "post_reports_status_idx" ON "public"."post_reports" USING "btree" ("status");



CREATE INDEX "post_votes_post_id_idx" ON "public"."post_votes" USING "btree" ("post_id");



CREATE INDEX "post_votes_post_id_vote_type_idx" ON "public"."post_votes" USING "btree" ("post_id", "vote_type");



CREATE INDEX "post_votes_user_id_idx" ON "public"."post_votes" USING "btree" ("user_id");



CREATE INDEX "posts_public_feed_idx" ON "public"."posts" USING "btree" ("created_at" DESC) WHERE (("is_deleted" = false) AND ("visibility" = 'public'::"text"));



CREATE INDEX "posts_removed_by_idx" ON "public"."posts" USING "btree" ("removed_by");



CREATE INDEX "posts_restored_by_idx" ON "public"."posts" USING "btree" ("restored_by");



CREATE INDEX "posts_sticky_feed_idx" ON "public"."posts" USING "btree" ("is_sticky" DESC, "sticky_at" DESC, "created_at" DESC) WHERE (("is_deleted" = false) AND ("visibility" = 'public'::"text"));



CREATE INDEX "posts_user_id_idx" ON "public"."posts" USING "btree" ("user_id");



CREATE INDEX "posts_visibility_deleted_created_at_idx" ON "public"."posts" USING "btree" ("visibility", "is_deleted", "created_at" DESC);



CREATE INDEX "profile_top_friends_friend_user_id_idx" ON "public"."profile_top_friends" USING "btree" ("friend_user_id");



CREATE INDEX "profile_top_friends_user_id_display_order_idx" ON "public"."profile_top_friends" USING "btree" ("user_id", "display_order");



CREATE INDEX "profile_top_friends_user_id_idx" ON "public"."profile_top_friends" USING "btree" ("user_id");



CREATE INDEX "profile_top_guns_user_id_display_order_idx" ON "public"."profile_top_guns" USING "btree" ("user_id", "display_order");



CREATE INDEX "profile_top_guns_user_id_idx" ON "public"."profile_top_guns" USING "btree" ("user_id");



CREATE INDEX "profiles_birthday_month_day_idx" ON "public"."profiles" USING "btree" (EXTRACT(month FROM "dob"), EXTRACT(day FROM "dob")) WHERE (("dob" IS NOT NULL) AND ("birthday_messages_enabled" = true));



CREATE INDEX "profiles_display_name_idx" ON "public"."profiles" USING "btree" ("display_name");



CREATE INDEX "profiles_is_deleted_idx" ON "public"."profiles" USING "btree" ("is_deleted");



CREATE INDEX "profiles_username_lower_idx" ON "public"."profiles" USING "btree" ("username_lower");



CREATE UNIQUE INDEX "user_rank_thresholds_sort_order_idx" ON "public"."user_rank_thresholds" USING "btree" ("sort_order");



CREATE OR REPLACE TRIGGER "auto_friend_ceo_after_profile_insert" AFTER INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."auto_friend_ceo_profile"();



CREATE OR REPLACE TRIGGER "create_notification_settings_after_profile_insert" AFTER INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."create_notification_settings_for_profile"();



CREATE OR REPLACE TRIGGER "enforce_ceo_sticky_posts_trigger" BEFORE INSERT OR UPDATE ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_ceo_sticky_posts"();



CREATE OR REPLACE TRIGGER "prevent_invalid_comment_reply_trigger" BEFORE INSERT OR UPDATE OF "parent_comment_id", "post_id" ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_invalid_comment_reply"();



CREATE OR REPLACE TRIGGER "set_abuse_reports_updated_at" BEFORE UPDATE ON "public"."abuse_reports" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_comments_updated_at" BEFORE UPDATE ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_friends_updated_at" BEFORE UPDATE ON "public"."friends" FOR EACH ROW EXECUTE FUNCTION "public"."set_friends_updated_at"();



CREATE OR REPLACE TRIGGER "set_notification_settings_updated_at" BEFORE UPDATE ON "public"."notification_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_post_reports_updated_at" BEFORE UPDATE ON "public"."post_reports" FOR EACH ROW EXECUTE FUNCTION "public"."set_post_reports_updated_at"();



CREATE OR REPLACE TRIGGER "set_post_votes_updated_at" BEFORE UPDATE ON "public"."post_votes" FOR EACH ROW EXECUTE FUNCTION "public"."set_post_votes_updated_at"();



CREATE OR REPLACE TRIGGER "set_posts_updated_at" BEFORE UPDATE ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_profile_top_friends_updated_at" BEFORE UPDATE ON "public"."profile_top_friends" FOR EACH ROW EXECUTE FUNCTION "public"."set_profile_showcase_updated_at"();



CREATE OR REPLACE TRIGGER "set_profile_top_guns_updated_at" BEFORE UPDATE ON "public"."profile_top_guns" FOR EACH ROW EXECUTE FUNCTION "public"."set_profile_showcase_updated_at"();



CREATE OR REPLACE TRIGGER "set_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_profiles_updated_at"();



CREATE OR REPLACE TRIGGER "set_profiles_username_lower_trigger" BEFORE INSERT OR UPDATE OF "username" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_profiles_username_lower"();



ALTER TABLE ONLY "public"."abuse_reports"
    ADD CONSTRAINT "abuse_reports_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."auth_events"
    ADD CONSTRAINT "auth_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friends"
    ADD CONSTRAINT "friends_addressee_id_fkey" FOREIGN KEY ("addressee_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friends"
    ADD CONSTRAINT "friends_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."moderation_actions"
    ADD CONSTRAINT "moderation_actions_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."moderation_actions"
    ADD CONSTRAINT "moderation_actions_related_post_id_fkey" FOREIGN KEY ("related_post_id") REFERENCES "public"."posts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."moderation_actions"
    ADD CONSTRAINT "moderation_actions_related_report_id_fkey" FOREIGN KEY ("related_report_id") REFERENCES "public"."post_reports"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."moderation_actions"
    ADD CONSTRAINT "moderation_actions_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."moderation_events"
    ADD CONSTRAINT "moderation_events_moderator_id_fkey" FOREIGN KEY ("moderator_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."moderation_events"
    ADD CONSTRAINT "moderation_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_settings"
    ADD CONSTRAINT "notification_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_friend_id_fkey" FOREIGN KEY ("friend_id") REFERENCES "public"."friends"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."poll_options"
    ADD CONSTRAINT "poll_options_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."poll_responses"
    ADD CONSTRAINT "poll_responses_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "public"."poll_options"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."poll_responses"
    ADD CONSTRAINT "poll_responses_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."poll_responses"
    ADD CONSTRAINT "poll_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."polls"
    ADD CONSTRAINT "polls_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_audit_logs"
    ADD CONSTRAINT "post_audit_logs_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."post_audit_logs"
    ADD CONSTRAINT "post_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_media"
    ADD CONSTRAINT "post_media_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_media"
    ADD CONSTRAINT "post_media_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_reports"
    ADD CONSTRAINT "post_reports_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_reports"
    ADD CONSTRAINT "post_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_reports"
    ADD CONSTRAINT "post_reports_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."post_votes"
    ADD CONSTRAINT "post_votes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_votes"
    ADD CONSTRAINT "post_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_removed_by_fkey" FOREIGN KEY ("removed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_restored_by_fkey" FOREIGN KEY ("restored_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_sticky_by_fkey" FOREIGN KEY ("sticky_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_top_friends"
    ADD CONSTRAINT "profile_top_friends_friend_user_id_fkey" FOREIGN KEY ("friend_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_top_friends"
    ADD CONSTRAINT "profile_top_friends_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_top_guns"
    ADD CONSTRAINT "profile_top_guns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_last_seen_rank_key_fkey" FOREIGN KEY ("last_seen_rank_key") REFERENCES "public"."user_rank_thresholds"("key") ON DELETE SET NULL;



CREATE POLICY "Admin and CEO can read abuse reports" ON "public"."abuse_reports" FOR SELECT TO "authenticated" USING ("public"."is_admin_or_ceo"());



CREATE POLICY "Admin and CEO can update abuse report status" ON "public"."abuse_reports" FOR UPDATE TO "authenticated" USING ("public"."is_admin_or_ceo"()) WITH CHECK (("public"."is_admin_or_ceo"() AND (("reviewed_by" IS NULL) OR ("reviewed_by" = "auth"."uid"()))));



CREATE POLICY "Admins can delete rank thresholds" ON "public"."user_rank_thresholds" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND (COALESCE("p"."role", 'user'::"text") = ANY (ARRAY['admin'::"text", 'ceo'::"text"]))))));



CREATE POLICY "Admins can insert rank thresholds" ON "public"."user_rank_thresholds" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND (COALESCE("p"."role", 'user'::"text") = ANY (ARRAY['admin'::"text", 'ceo'::"text"]))))));



CREATE POLICY "Admins can update rank thresholds" ON "public"."user_rank_thresholds" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND (COALESCE("p"."role", 'user'::"text") = ANY (ARRAY['admin'::"text", 'ceo'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND (COALESCE("p"."role", 'user'::"text") = ANY (ARRAY['admin'::"text", 'ceo'::"text"]))))));



CREATE POLICY "Authenticated users can read rank thresholds" ON "public"."user_rank_thresholds" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Moderators and above can read all post reports" ON "public"."post_reports" FOR SELECT TO "authenticated" USING ("public"."is_moderator_or_above"());



CREATE POLICY "Moderators and above can update post reports" ON "public"."post_reports" FOR UPDATE TO "authenticated" USING ("public"."is_moderator_or_above"()) WITH CHECK ("public"."is_moderator_or_above"());



CREATE POLICY "Users can create their own post reports" ON "public"."post_reports" FOR INSERT TO "authenticated" WITH CHECK (("public"."current_user_can_interact"() AND ("reporter_id" = "auth"."uid"()) AND ("status" = 'open'::"text") AND ("reviewed_by" IS NULL) AND ("reviewed_at" IS NULL)));



CREATE POLICY "Users can read their own post reports" ON "public"."post_reports" FOR SELECT TO "authenticated" USING (("reporter_id" = "auth"."uid"()));



ALTER TABLE "public"."abuse_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."auth_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "auth_events_insert_anon_pre_auth" ON "public"."auth_events" FOR INSERT TO "anon" WITH CHECK (("user_id" IS NULL));



CREATE POLICY "auth_events_insert_own_or_pre_auth" ON "public"."auth_events" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) OR ("user_id" IS NULL)));



CREATE POLICY "auth_events_select_own" ON "public"."auth_events" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comments_insert_own_visible_public_post" ON "public"."comments" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND ("is_deleted" = false) AND ("deleted_at" IS NULL) AND "public"."current_user_can_interact"() AND (EXISTS ( SELECT 1
   FROM "public"."posts" "p"
  WHERE (("p"."id" = "comments"."post_id") AND ("p"."is_deleted" = false) AND ("p"."visibility" = 'public'::"text"))))));



CREATE POLICY "comments_select_visible_public_post" ON "public"."comments" FOR SELECT TO "authenticated", "anon" USING ((("is_deleted" = false) AND (EXISTS ( SELECT 1
   FROM "public"."posts" "p"
  WHERE (("p"."id" = "comments"."post_id") AND ("p"."is_deleted" = false) AND ("p"."visibility" = 'public'::"text"))))));



CREATE POLICY "comments_update_own_non_deleted" ON "public"."comments" FOR UPDATE TO "authenticated" USING ((("auth"."uid"() = "user_id") AND ("is_deleted" = false) AND "public"."current_user_can_interact"())) WITH CHECK ((("auth"."uid"() = "user_id") AND "public"."current_user_can_interact"() AND (EXISTS ( SELECT 1
   FROM "public"."posts" "p"
  WHERE (("p"."id" = "comments"."post_id") AND ("p"."is_deleted" = false) AND ("p"."visibility" = 'public'::"text")))) AND ((("is_deleted" = false) AND ("deleted_at" IS NULL)) OR (("is_deleted" = true) AND ("deleted_at" IS NOT NULL)))));



ALTER TABLE "public"."friends" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "friends_addressee_updates_pending_request" ON "public"."friends" FOR UPDATE TO "authenticated" USING ((("auth"."uid"() = "addressee_id") AND ("status" = 'pending'::"text"))) WITH CHECK ((("auth"."uid"() = "addressee_id") AND ("status" = ANY (ARRAY['accepted'::"text", 'declined'::"text"]))));



CREATE POLICY "friends_either_user_can_remove_accepted_friendship" ON "public"."friends" FOR DELETE TO "authenticated" USING ((("status" = 'accepted'::"text") AND (("auth"."uid"() = "requester_id") OR ("auth"."uid"() = "addressee_id"))));



CREATE POLICY "friends_insert_pending_only_by_requester" ON "public"."friends" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "requester_id") AND ("requester_id" <> "addressee_id") AND ("status" = 'pending'::"text") AND "public"."current_user_can_interact"()));



CREATE POLICY "friends_requester_can_cancel_pending_request" ON "public"."friends" FOR DELETE TO "authenticated" USING ((("auth"."uid"() = "requester_id") AND ("status" = 'pending'::"text")));



CREATE POLICY "friends_select_involved_users" ON "public"."friends" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "requester_id") OR ("auth"."uid"() = "addressee_id")));



ALTER TABLE "public"."moderation_actions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "moderation_actions_insert_moderators" ON "public"."moderation_actions" FOR INSERT TO "authenticated" WITH CHECK ((("actor_user_id" = "auth"."uid"()) AND ((("action_type" = ANY (ARRAY['dismiss_report'::"text", 'review_report'::"text", 'admin_note'::"text"])) AND "public"."is_moderator_or_above"()) OR (("action_type" = ANY (ARRAY['warn'::"text", 'mute'::"text", 'unmute'::"text", 'ban'::"text", 'unban'::"text"])) AND ((("public"."get_current_moderation_actor_role"() = 'ceo'::"text") AND ("target_user_id" <> "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "target_profile"
  WHERE (("target_profile"."id" = "moderation_actions"."target_user_id") AND ("target_profile"."role" <> 'ceo'::"text") AND (COALESCE("target_profile"."is_deleted", false) = false))))) OR (("public"."get_current_moderation_actor_role"() = 'admin'::"text") AND ("target_user_id" <> "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "target_profile"
  WHERE (("target_profile"."id" = "moderation_actions"."target_user_id") AND ("target_profile"."role" = ANY (ARRAY['user'::"text", 'moderator'::"text"])) AND (COALESCE("target_profile"."is_deleted", false) = false))))))) OR (("action_type" = 'remove_post'::"text") AND (("public"."get_current_moderation_actor_role"() = 'ceo'::"text") OR (("public"."get_current_moderation_actor_role"() = 'admin'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "target_profile"
  WHERE (("target_profile"."id" = "moderation_actions"."target_user_id") AND ("target_profile"."role" = ANY (ARRAY['user'::"text", 'moderator'::"text"])) AND (COALESCE("target_profile"."is_deleted", false) = false))))))) OR (("action_type" = 'restore_post'::"text") AND ("public"."get_current_moderation_actor_role"() = 'ceo'::"text")) OR (("action_type" = ANY (ARRAY['promote_user'::"text", 'demote_user'::"text"])) AND "public"."is_ceo"()))));



CREATE POLICY "moderation_actions_select_moderators" ON "public"."moderation_actions" FOR SELECT TO "authenticated" USING ("public"."is_moderator_or_above"());



ALTER TABLE "public"."moderation_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "moderation_events_select_moderators" ON "public"."moderation_events" FOR SELECT TO "authenticated" USING ("public"."is_moderator_or_above"());



ALTER TABLE "public"."notification_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notification_settings_insert_own" ON "public"."notification_settings" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "notification_settings_select_own" ON "public"."notification_settings" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "notification_settings_update_own" ON "public"."notification_settings" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_delete_own" ON "public"."notifications" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "notifications_select_own" ON "public"."notifications" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "notifications_update_own" ON "public"."notifications" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."poll_options" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "poll_options_insert_own_public_post" ON "public"."poll_options" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."polls" "po"
     JOIN "public"."posts" "p" ON (("p"."id" = "po"."post_id")))
  WHERE (("po"."id" = "poll_options"."poll_id") AND ("p"."user_id" = "auth"."uid"()) AND ("p"."is_deleted" = false) AND ("p"."visibility" = 'public'::"text")))));



CREATE POLICY "poll_options_select_visible_public_posts" ON "public"."poll_options" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM ("public"."polls" "po"
     JOIN "public"."posts" "p" ON (("p"."id" = "po"."post_id")))
  WHERE (("po"."id" = "poll_options"."poll_id") AND ("p"."is_deleted" = false) AND ("p"."visibility" = 'public'::"text")))));



ALTER TABLE "public"."poll_responses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "poll_responses_delete_own_visible_public_post" ON "public"."poll_responses" FOR DELETE TO "authenticated" USING (("public"."current_user_can_interact"() AND ("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM ("public"."polls" "po"
     JOIN "public"."posts" "p" ON (("p"."id" = "po"."post_id")))
  WHERE (("po"."id" = "poll_responses"."poll_id") AND ("p"."is_deleted" = false) AND ("p"."visibility" = 'public'::"text"))))));



CREATE POLICY "poll_responses_insert_own_visible_public_post" ON "public"."poll_responses" FOR INSERT TO "authenticated" WITH CHECK (("public"."current_user_can_interact"() AND ("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM (("public"."poll_options" "po"
     JOIN "public"."polls" "poll" ON (("poll"."id" = "po"."poll_id")))
     JOIN "public"."posts" "p" ON (("p"."id" = "poll"."post_id")))
  WHERE (("po"."id" = "poll_responses"."option_id") AND ("po"."poll_id" = "poll_responses"."poll_id") AND ("p"."is_deleted" = false) AND ("p"."visibility" = 'public'::"text"))))));



CREATE POLICY "poll_responses_select_own_visible_public_post" ON "public"."poll_responses" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM ("public"."polls" "po"
     JOIN "public"."posts" "p" ON (("p"."id" = "po"."post_id")))
  WHERE (("po"."id" = "poll_responses"."poll_id") AND ("p"."is_deleted" = false) AND ("p"."visibility" = 'public'::"text"))))));



CREATE POLICY "poll_responses_update_own_visible_public_post" ON "public"."poll_responses" FOR UPDATE TO "authenticated" USING (("public"."current_user_can_interact"() AND ("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM ("public"."polls" "po"
     JOIN "public"."posts" "p" ON (("p"."id" = "po"."post_id")))
  WHERE (("po"."id" = "poll_responses"."poll_id") AND ("p"."is_deleted" = false) AND ("p"."visibility" = 'public'::"text")))))) WITH CHECK (("public"."current_user_can_interact"() AND ("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM (("public"."poll_options" "po"
     JOIN "public"."polls" "poll" ON (("poll"."id" = "po"."poll_id")))
     JOIN "public"."posts" "p" ON (("p"."id" = "poll"."post_id")))
  WHERE (("po"."id" = "poll_responses"."option_id") AND ("po"."poll_id" = "poll_responses"."poll_id") AND ("p"."is_deleted" = false) AND ("p"."visibility" = 'public'::"text"))))));



ALTER TABLE "public"."polls" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "polls_insert_own_public_post" ON "public"."polls" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."posts" "p"
  WHERE (("p"."id" = "polls"."post_id") AND ("p"."user_id" = "auth"."uid"()) AND ("p"."is_deleted" = false) AND ("p"."visibility" = 'public'::"text")))));



CREATE POLICY "polls_select_visible_public_posts" ON "public"."polls" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."posts" "p"
  WHERE (("p"."id" = "polls"."post_id") AND ("p"."is_deleted" = false) AND ("p"."visibility" = 'public'::"text")))));



ALTER TABLE "public"."post_audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "post_audit_logs_insert_own" ON "public"."post_audit_logs" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."post_media" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "post_media_delete_own_post" ON "public"."post_media" FOR DELETE TO "authenticated" USING (("public"."current_user_can_interact"() AND ("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."posts" "p"
  WHERE (("p"."id" = "post_media"."post_id") AND ("p"."user_id" = "auth"."uid"()) AND ("p"."is_deleted" = false))))));



CREATE POLICY "post_media_insert_own_post_trusted_source" ON "public"."post_media" FOR INSERT TO "authenticated" WITH CHECK (("public"."current_user_can_interact"() AND ("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."posts" "p"
  WHERE (("p"."id" = "post_media"."post_id") AND ("p"."user_id" = "auth"."uid"()) AND ("p"."is_deleted" = false) AND ("p"."visibility" = 'public'::"text")))) AND ((("provider" = 'cloudinary'::"text") AND ("media_type" = ANY (ARRAY['image'::"text", 'video'::"text"])) AND ("cloudinary_url" IS NOT NULL) AND ("cloudinary_public_id" IS NOT NULL) AND ("cloudinary_public_id" ~~ (((('triggerfeed/posts/'::"text" || ("auth"."uid"())::"text") || '/'::"text") || ("post_id")::"text") || '/%'::"text")) AND ("cloudinary_url" ~~ 'https://res.cloudinary.com/triggerfeed/%'::"text") AND (("cloudinary_secure_url" IS NULL) OR ("cloudinary_secure_url" ~~ 'https://res.cloudinary.com/triggerfeed/%'::"text"))) OR (("provider" = 'giphy'::"text") AND ("media_type" = 'gif'::"text") AND ("external_url" IS NOT NULL) AND (("external_url" ~~ 'https://media.giphy.com/%'::"text") OR ("external_url" ~~ 'https://media%.giphy.com/%'::"text") OR ("external_url" ~~ 'https://i.giphy.com/%'::"text")) AND (("thumbnail_url" IS NULL) OR ("thumbnail_url" ~~ 'https://media.giphy.com/%'::"text") OR ("thumbnail_url" ~~ 'https://media%.giphy.com/%'::"text") OR ("thumbnail_url" ~~ 'https://i.giphy.com/%'::"text"))))));



COMMENT ON POLICY "post_media_insert_own_post_trusted_source" ON "public"."post_media" IS 'Cloudinary production cloud name is intentionally fixed to triggerfeed for beta. If staging/prod diverge, deploy an environment-specific policy migration before uploads.';



CREATE POLICY "post_media_select_visible_public_post" ON "public"."post_media" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."posts" "p"
  WHERE (("p"."id" = "post_media"."post_id") AND ("p"."is_deleted" = false) AND ("p"."visibility" = 'public'::"text")))));



CREATE POLICY "post_media_update_own_post_trusted_source" ON "public"."post_media" FOR UPDATE TO "authenticated" USING (("public"."current_user_can_interact"() AND ("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."posts" "p"
  WHERE (("p"."id" = "post_media"."post_id") AND ("p"."user_id" = "auth"."uid"()) AND ("p"."is_deleted" = false) AND ("p"."visibility" = 'public'::"text")))))) WITH CHECK (("public"."current_user_can_interact"() AND ("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."posts" "p"
  WHERE (("p"."id" = "post_media"."post_id") AND ("p"."user_id" = "auth"."uid"()) AND ("p"."is_deleted" = false) AND ("p"."visibility" = 'public'::"text")))) AND ((("provider" = 'cloudinary'::"text") AND ("media_type" = ANY (ARRAY['image'::"text", 'video'::"text"])) AND ("cloudinary_url" IS NOT NULL) AND ("cloudinary_public_id" IS NOT NULL) AND ("cloudinary_public_id" ~~ (((('triggerfeed/posts/'::"text" || ("auth"."uid"())::"text") || '/'::"text") || ("post_id")::"text") || '/%'::"text")) AND ("cloudinary_url" ~~ 'https://res.cloudinary.com/triggerfeed/%'::"text") AND (("cloudinary_secure_url" IS NULL) OR ("cloudinary_secure_url" ~~ 'https://res.cloudinary.com/triggerfeed/%'::"text"))) OR (("provider" = 'giphy'::"text") AND ("media_type" = 'gif'::"text") AND ("external_url" IS NOT NULL) AND (("external_url" ~~ 'https://media.giphy.com/%'::"text") OR ("external_url" ~~ 'https://media%.giphy.com/%'::"text") OR ("external_url" ~~ 'https://i.giphy.com/%'::"text")) AND (("thumbnail_url" IS NULL) OR ("thumbnail_url" ~~ 'https://media.giphy.com/%'::"text") OR ("thumbnail_url" ~~ 'https://media%.giphy.com/%'::"text") OR ("thumbnail_url" ~~ 'https://i.giphy.com/%'::"text"))))));



ALTER TABLE "public"."post_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."post_votes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "posts_insert_own_public" ON "public"."posts" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND ("visibility" = 'public'::"text") AND ("is_deleted" = false) AND ("deleted_at" IS NULL) AND "public"."current_user_can_interact"()));



CREATE POLICY "posts_select_visible_public" ON "public"."posts" FOR SELECT TO "authenticated", "anon" USING ((("is_deleted" = false) AND ("visibility" = 'public'::"text")));



CREATE POLICY "posts_update_own_non_deleted" ON "public"."posts" FOR UPDATE TO "authenticated" USING ((("auth"."uid"() = "user_id") AND ("is_deleted" = false) AND "public"."current_user_can_interact"())) WITH CHECK ((("auth"."uid"() = "user_id") AND ("visibility" = 'public'::"text") AND "public"."current_user_can_interact"() AND ((("is_deleted" = false) AND ("deleted_at" IS NULL)) OR (("is_deleted" = true) AND ("deleted_at" IS NOT NULL)))));



ALTER TABLE "public"."profile_top_friends" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profile_top_friends_manage_own" ON "public"."profile_top_friends" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK ((("auth"."uid"() = "user_id") AND "public"."are_users_accepted_friends"("user_id", "friend_user_id")));



CREATE POLICY "profile_top_friends_select_visible_profiles" ON "public"."profile_top_friends" FOR SELECT TO "authenticated", "anon" USING ("public"."is_profile_visible"("user_id"));



ALTER TABLE "public"."profile_top_guns" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profile_top_guns_manage_own" ON "public"."profile_top_guns" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "profile_top_guns_select_visible_profiles" ON "public"."profile_top_guns" FOR SELECT TO "authenticated", "anon" USING ("public"."is_profile_visible"("user_id"));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert_own_safe" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "profiles_select_visible" ON "public"."profiles" FOR SELECT TO "authenticated", "anon" USING ((COALESCE("is_deleted", false) = false));



CREATE POLICY "profiles_update_own_safe_columns" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



ALTER TABLE "public"."user_rank_thresholds" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "public"."are_users_accepted_friends"("p_user_id" "uuid", "p_friend_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."are_users_accepted_friends"("p_user_id" "uuid", "p_friend_user_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."assert_current_user_can_interact"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assert_current_user_can_interact"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."auto_friend_ceo_profile"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."change_user_role"("p_target_user_id" "uuid", "p_new_role" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."change_user_role"("p_target_user_id" "uuid", "p_new_role" "text", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_comment_notification"("p_post_id" "uuid", "p_comment_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_comment_notification"("p_post_id" "uuid", "p_comment_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_friend_accepted_notification"("p_friend_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_friend_accepted_notification"("p_friend_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_friend_request_notification"("p_friend_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_friend_request_notification"("p_friend_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_mention_notification"("p_user_id" "uuid", "p_post_id" "uuid", "p_comment_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_mention_notification"("p_user_id" "uuid", "p_post_id" "uuid", "p_comment_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_notification_settings_for_profile"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."create_post_transactional"("p_title" "text", "p_body" "text", "p_visibility" "text", "p_is_sticky" boolean, "p_gif" "jsonb", "p_poll" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_post_transactional"("p_title" "text", "p_body" "text", "p_visibility" "text", "p_is_sticky" boolean, "p_gif" "jsonb", "p_poll" "jsonb") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_reply_notification"("p_parent_comment_id" "uuid", "p_reply_comment_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_reply_notification"("p_parent_comment_id" "uuid", "p_reply_comment_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."current_user_can_interact"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_user_can_interact"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."current_user_is_ceo"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_user_is_ceo"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."enforce_ceo_sticky_posts"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."get_admin_nav_counts"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_admin_nav_counts"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_current_moderation_actor_role"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_current_moderation_actor_role"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_feed_post_ranks"("p_post_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_feed_post_ranks"("p_post_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_feed_post_ranks"("p_post_ids" "uuid"[]) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_friend_suggestions"("p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_friend_suggestions"("p_limit" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_moderation_event_email_context"("p_event_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_moderation_event_email_context"("p_event_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_moderation_profile_cards"("p_profile_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_moderation_profile_cards"("p_profile_ids" "uuid"[]) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_my_poll_responses"("p_poll_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_poll_responses"("p_poll_ids" "uuid"[]) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_my_post_votes"("p_post_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_post_votes"("p_post_ids" "uuid"[]) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_my_profile"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_profile"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_my_profile_auth_status"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_profile_auth_status"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_poll_results"("p_poll_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_poll_results"("p_poll_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_poll_results"("p_poll_ids" "uuid"[]) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_post_reports_for_moderation"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_post_reports_for_moderation"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_post_vote_counts"("p_post_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_post_vote_counts"("p_post_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_post_vote_counts"("p_post_ids" "uuid"[]) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_profile_friend_count"("target_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_profile_friend_count"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_profile_friend_count"("target_user_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_public_profile"("p_profile_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_public_profile"("p_profile_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_profile"("p_profile_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_public_profile_cards"("p_profile_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_public_profile_cards"("p_profile_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_profile_cards"("p_profile_ids" "uuid"[]) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_user_rank"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_rank"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_rank"("p_user_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."insert_account_moderation_notice"("p_target_user_id" "uuid", "p_moderator_id" "uuid", "p_action" "text", "p_reason" "text", "p_expires_at" timestamp with time zone) FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."is_admin_or_above"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_admin_or_above"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."is_admin_or_ceo"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_admin_or_ceo"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."is_adult_dob"("p_dob" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_adult_dob"("p_dob" "date") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."is_ceo"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_ceo"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."is_moderator_or_above"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_moderator_or_above"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."is_profile_visible"("p_profile_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_profile_visible"("p_profile_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_profile_visible"("p_profile_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."mark_moderation_event_email_result"("p_event_id" "uuid", "p_email_sent" boolean, "p_email_error" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_moderation_event_email_result"("p_event_id" "uuid", "p_email_sent" boolean, "p_email_error" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."moderation_add_admin_note"("p_target_user_id" "uuid", "p_note" "text", "p_related_post_id" "uuid", "p_related_report_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."moderation_add_admin_note"("p_target_user_id" "uuid", "p_note" "text", "p_related_post_id" "uuid", "p_related_report_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."moderation_assert_target_profile"("p_target_user_id" "uuid") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."moderation_ban_user"("p_target_user_id" "uuid", "p_reason" "text", "p_expires_at" timestamp with time zone, "p_related_post_id" "uuid", "p_related_report_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."moderation_ban_user"("p_target_user_id" "uuid", "p_reason" "text", "p_expires_at" timestamp with time zone, "p_related_post_id" "uuid", "p_related_report_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."moderation_mute_user"("p_target_user_id" "uuid", "p_reason" "text", "p_expires_at" timestamp with time zone, "p_related_post_id" "uuid", "p_related_report_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."moderation_mute_user"("p_target_user_id" "uuid", "p_reason" "text", "p_expires_at" timestamp with time zone, "p_related_post_id" "uuid", "p_related_report_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."moderation_remove_post"("p_post_id" "uuid", "p_reason" "text", "p_related_report_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."moderation_remove_post"("p_post_id" "uuid", "p_reason" "text", "p_related_report_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."moderation_restore_post"("p_post_id" "uuid", "p_reason" "text", "p_related_report_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."moderation_restore_post"("p_post_id" "uuid", "p_reason" "text", "p_related_report_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."moderation_unban_user"("p_target_user_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."moderation_unban_user"("p_target_user_id" "uuid", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."moderation_unmute_user"("p_target_user_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."moderation_unmute_user"("p_target_user_id" "uuid", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."moderation_update_report_status"("p_report_id" "uuid", "p_status" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."moderation_update_report_status"("p_report_id" "uuid", "p_status" "text", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."moderation_update_user_role"("p_target_user_id" "uuid", "p_new_role" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."moderation_update_user_role"("p_target_user_id" "uuid", "p_new_role" "text", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."moderation_warn_user"("p_target_user_id" "uuid", "p_reason" "text", "p_message" "text", "p_related_post_id" "uuid", "p_related_report_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."moderation_warn_user"("p_target_user_id" "uuid", "p_reason" "text", "p_message" "text", "p_related_post_id" "uuid", "p_related_report_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."prevent_invalid_comment_reply"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."repair_my_age_gate"("p_dob" "date", "p_age_gate_version" "text", "p_birthday_messages_enabled" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."repair_my_age_gate"("p_dob" "date", "p_age_gate_version" "text", "p_birthday_messages_enabled" boolean) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."search_admin_users"("p_query" "text", "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."search_admin_users"("p_query" "text", "p_limit" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."search_friend_candidates"("p_query" "text", "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."search_friend_candidates"("p_query" "text", "p_limit" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."should_create_notification"("p_user_id" "uuid", "p_type" "text") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."soft_delete_comment"("target_comment_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."soft_delete_comment"("target_comment_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."soft_delete_comment_thread"("target_comment_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."soft_delete_comment_thread"("target_comment_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."soft_delete_my_account"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."soft_delete_my_account"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."soft_delete_post"("target_post_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."soft_delete_post"("target_post_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."toggle_post_vote"("target_post_id" "uuid", "target_vote_type" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."toggle_post_vote"("target_post_id" "uuid", "target_vote_type" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."update_post_transactional"("p_post_id" "uuid", "p_title" "text", "p_body" "text", "p_visibility" "text", "p_is_sticky" boolean, "p_gif" "jsonb", "p_remove_gif" boolean, "p_poll" "jsonb", "p_remove_poll" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_post_transactional"("p_post_id" "uuid", "p_title" "text", "p_body" "text", "p_visibility" "text", "p_is_sticky" boolean, "p_gif" "jsonb", "p_remove_gif" boolean, "p_poll" "jsonb", "p_remove_poll" boolean) TO "authenticated";


















GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."abuse_reports" TO "service_role";
GRANT SELECT ON TABLE "public"."abuse_reports" TO "authenticated";



GRANT UPDATE("status") ON TABLE "public"."abuse_reports" TO "authenticated";



GRANT UPDATE("reviewed_by") ON TABLE "public"."abuse_reports" TO "authenticated";



GRANT UPDATE("reviewed_at") ON TABLE "public"."abuse_reports" TO "authenticated";



GRANT UPDATE("updated_at") ON TABLE "public"."abuse_reports" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."auth_events" TO "service_role";
GRANT INSERT ON TABLE "public"."auth_events" TO "anon";
GRANT SELECT,INSERT ON TABLE "public"."auth_events" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."comments" TO "service_role";
GRANT SELECT ON TABLE "public"."comments" TO "anon";
GRANT SELECT,INSERT ON TABLE "public"."comments" TO "authenticated";



GRANT UPDATE("body") ON TABLE "public"."comments" TO "authenticated";



GRANT UPDATE("is_deleted") ON TABLE "public"."comments" TO "authenticated";



GRANT UPDATE("deleted_at") ON TABLE "public"."comments" TO "authenticated";



GRANT UPDATE("updated_at") ON TABLE "public"."comments" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."friends" TO "service_role";
GRANT SELECT,INSERT,DELETE ON TABLE "public"."friends" TO "authenticated";



GRANT UPDATE("status") ON TABLE "public"."friends" TO "authenticated";



GRANT UPDATE("updated_at") ON TABLE "public"."friends" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."moderation_actions" TO "service_role";
GRANT SELECT,INSERT ON TABLE "public"."moderation_actions" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."moderation_events" TO "service_role";
GRANT SELECT ON TABLE "public"."moderation_events" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."notification_settings" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."notification_settings" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."notifications" TO "service_role";
GRANT SELECT,DELETE,UPDATE ON TABLE "public"."notifications" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."poll_options" TO "service_role";
GRANT SELECT ON TABLE "public"."poll_options" TO "anon";
GRANT SELECT,INSERT ON TABLE "public"."poll_options" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."poll_responses" TO "service_role";
GRANT INSERT,DELETE,UPDATE ON TABLE "public"."poll_responses" TO "authenticated";



GRANT SELECT("id") ON TABLE "public"."poll_responses" TO "authenticated";



GRANT SELECT("poll_id") ON TABLE "public"."poll_responses" TO "authenticated";



GRANT SELECT("option_id") ON TABLE "public"."poll_responses" TO "authenticated";



GRANT SELECT("user_id") ON TABLE "public"."poll_responses" TO "authenticated";



GRANT SELECT("created_at") ON TABLE "public"."poll_responses" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."polls" TO "service_role";
GRANT SELECT ON TABLE "public"."polls" TO "anon";
GRANT SELECT,INSERT ON TABLE "public"."polls" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."post_audit_logs" TO "service_role";
GRANT INSERT ON TABLE "public"."post_audit_logs" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."post_media" TO "service_role";
GRANT SELECT ON TABLE "public"."post_media" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."post_media" TO "authenticated";



GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."post_reports" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."post_reports" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."post_votes" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."posts" TO "service_role";
GRANT SELECT ON TABLE "public"."posts" TO "anon";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."posts" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."post_vote_counts" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profile_top_friends" TO "service_role";
GRANT SELECT ON TABLE "public"."profile_top_friends" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."profile_top_friends" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profile_top_guns" TO "service_role";
GRANT SELECT ON TABLE "public"."profile_top_guns" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."profile_top_guns" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("id"),INSERT("id") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("email") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("username") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("username"),INSERT("username"),UPDATE("username") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("username_lower") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("username_lower") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("display_name") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("display_name"),INSERT("display_name"),UPDATE("display_name") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("first_name"),UPDATE("first_name") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("last_name"),UPDATE("last_name") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("city"),UPDATE("city") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("state"),UPDATE("state") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("bio") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("bio"),INSERT("bio"),UPDATE("bio") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("dob"),UPDATE("dob") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("birthday_messages_enabled"),UPDATE("birthday_messages_enabled") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("avatar_cloudinary_url") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("avatar_cloudinary_url"),INSERT("avatar_cloudinary_url"),UPDATE("avatar_cloudinary_url") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("avatar_cloudinary_public_id"),UPDATE("avatar_cloudinary_public_id") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("banner_cloudinary_url") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("banner_cloudinary_url"),INSERT("banner_cloudinary_url"),UPDATE("banner_cloudinary_url") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("banner_cloudinary_public_id"),UPDATE("banner_cloudinary_public_id") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("profile_badge") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("profile_badge") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("privacy_settings"),UPDATE("privacy_settings") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("created_at") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("created_at"),INSERT("created_at") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("updated_at") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("updated_at"),INSERT("updated_at"),UPDATE("updated_at") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("last_seen_rank_key") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("last_seen_rank_at") ON TABLE "public"."profiles" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_rank_thresholds" TO "service_role";
GRANT SELECT ON TABLE "public"."user_rank_thresholds" TO "anon";
GRANT SELECT ON TABLE "public"."user_rank_thresholds" TO "authenticated";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "service_role";































