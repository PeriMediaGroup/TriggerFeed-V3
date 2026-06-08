-- =========================================================
-- 151: Fix Moderation Profile Permission Guards
-- =========================================================

begin;

create or replace function public.is_moderator_or_above()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
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

create or replace function public.is_admin_or_above()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
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

create or replace function public.is_ceo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
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

revoke all on function public.is_moderator_or_above() from public;
revoke all on function public.is_admin_or_above() from public;
revoke all on function public.is_ceo() from public;
grant execute on function public.is_moderator_or_above() to authenticated;
grant execute on function public.is_admin_or_above() to authenticated;
grant execute on function public.is_ceo() to authenticated;

create or replace function public.current_user_can_interact()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
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

create or replace function public.assert_current_user_can_interact()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
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

revoke all on function public.current_user_can_interact() from public;
revoke all on function public.assert_current_user_can_interact() from public;
grant execute on function public.current_user_can_interact() to authenticated;
grant execute on function public.assert_current_user_can_interact() to authenticated;

drop policy if exists "posts_insert_own_public"
on public.posts;

create policy "posts_insert_own_public"
on public.posts
for insert
to authenticated
with check (
  auth.uid() = user_id
  and visibility = 'public'
  and is_deleted = false
  and deleted_at is null
  and public.current_user_can_interact()
);

drop policy if exists "comments_insert_own_visible_public_post"
on public.comments;

create policy "comments_insert_own_visible_public_post"
on public.comments
for insert
to authenticated
with check (
  auth.uid() = user_id
  and is_deleted = false
  and deleted_at is null
  and public.current_user_can_interact()
  and exists (
    select 1
    from public.posts p
    where p.id = comments.post_id
      and p.is_deleted = false
      and p.visibility = 'public'
  )
);

drop policy if exists "friends_insert_pending_only_by_requester"
on public.friends;

create policy "friends_insert_pending_only_by_requester"
on public.friends
for insert
to authenticated
with check (
  auth.uid() = requester_id
  and requester_id <> addressee_id
  and status = 'pending'
  and public.current_user_can_interact()
);

create or replace function public.moderation_assert_target_profile(
  p_target_user_id uuid
)
returns table (
  id uuid,
  role text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.role
  from public.profiles p
  where p.id = p_target_user_id
    and coalesce(p.is_deleted, false) = false
  limit 1;
$$;

revoke all on function public.moderation_assert_target_profile(uuid) from public;

create or replace function public.moderation_warn_user(
  p_target_user_id uuid,
  p_reason text,
  p_message text default null,
  p_related_post_id uuid default null,
  p_related_report_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action_id uuid;
begin
  if not public.is_moderator_or_above() then
    raise exception 'Moderator permission required';
  end if;

  if not exists (
    select 1
    from public.moderation_assert_target_profile(p_target_user_id)
  ) then
    raise exception 'Target user not found';
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
    p_related_post_id,
    p_related_report_id,
    'warn',
    nullif(trim(coalesce(p_reason, '')), ''),
    nullif(trim(coalesce(p_message, '')), '')
  )
  returning id into v_action_id;

  insert into public.notifications (
    user_id,
    actor_id,
    type,
    post_id,
    title,
    body,
    metadata
  )
  values (
    p_target_user_id,
    null,
    'moderation_warning',
    p_related_post_id,
    'Moderation warning',
    'You received a warning from TriggerFeed moderation.',
    jsonb_strip_nulls(jsonb_build_object(
      'moderation_action_id', v_action_id,
      'related_post_id', p_related_post_id,
      'related_report_id', p_related_report_id,
      'message', nullif(trim(coalesce(p_message, '')), '')
    ))
  );

  return v_action_id;
end;
$$;

revoke all on function public.moderation_warn_user(uuid, text, text, uuid, uuid) from public;
grant execute on function public.moderation_warn_user(uuid, text, text, uuid, uuid) to authenticated;

create or replace function public.toggle_post_vote(
  target_post_id uuid,
  target_vote_type text
)
returns table (
  post_id uuid,
  user_vote text,
  score integer,
  vote_score integer,
  vote_count integer,
  upvote_count integer,
  downvote_count integer,
  interaction_count integer
)
language plpgsql
security definer
set search_path = public
as $$
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

revoke all on function public.toggle_post_vote(uuid, text) from public;
grant execute on function public.toggle_post_vote(uuid, text) to authenticated;

commit;
