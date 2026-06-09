-- =========================================================
-- 162: Exclude CEO From Friend Suggestion Mutuals
-- =========================================================

begin;

create or replace function public.get_friend_suggestions(
  p_limit integer default 4
)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_cloudinary_url text,
  suggestion_reason text,
  mutual_friend_count integer,
  rank_score integer
)
language sql
security definer
set search_path = public
as $$
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

revoke all on function public.get_friend_suggestions(integer) from public;
grant execute on function public.get_friend_suggestions(integer) to authenticated;

commit;
