begin;

-- Public profile reads must not expose the user's raw privacy preferences.
-- The RPC keeps its existing shape for callers, but privacy_settings is always null.
create or replace function public.get_public_profile(p_profile_id uuid)
returns table (
  id uuid,
  username text,
  display_name text,
  first_name text,
  last_name text,
  age int,
  email text,
  city text,
  state text,
  bio text,
  avatar_cloudinary_url text,
  banner_cloudinary_url text,
  profile_badge text,
  privacy_settings jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
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
          when lower(p.privacy_settings #>> '{profile_visibility,show_age}') in ('true', 'false')
            then (p.privacy_settings #>> '{profile_visibility,show_age}')::boolean
          else false
        end then date_part('year', age(current_date, p.dob))::int
      else null
    end as age,
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

revoke all on function public.get_public_profile(uuid) from public;
grant execute on function public.get_public_profile(uuid) to anon, authenticated;

-- Raw vote rows are behavioral data. Keep direct table reads closed and expose only
-- aggregate counts plus the current user's own vote RPC.
drop policy if exists "post_votes_select_visible_public_posts" on public.post_votes;
revoke select on public.post_votes from anon;
revoke select on public.post_votes from authenticated;

drop view if exists public.post_vote_counts;
create or replace view public.post_vote_counts
as
select
  p.id as post_id,
  count(pv.vote_type) filter (where pv.vote_type = 'upvote')::integer as upvote_count,
  count(pv.vote_type) filter (where pv.vote_type = 'downvote')::integer as downvote_count,
  (
    count(pv.vote_type) filter (where pv.vote_type = 'upvote')
    -
    count(pv.vote_type) filter (where pv.vote_type = 'downvote')
  )::integer as score,
  (
    count(pv.vote_type) filter (where pv.vote_type = 'upvote')
    -
    count(pv.vote_type) filter (where pv.vote_type = 'downvote')
  )::integer as vote_score,
  count(pv.vote_type)::integer as vote_count,
  count(pv.vote_type)::integer as interaction_count
from public.posts p
left join public.post_votes pv
  on pv.post_id = p.id
where p.is_deleted = false
  and p.visibility = 'public'
group by p.id;

grant select on public.post_vote_counts to anon, authenticated;

-- Prevent this helper from becoming an arbitrary accepted-friendship oracle.
create or replace function public.are_users_accepted_friends(
  p_user_id uuid,
  p_friend_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
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

revoke all on function public.are_users_accepted_friends(uuid, uuid) from public;
grant execute on function public.are_users_accepted_friends(uuid, uuid) to authenticated;

create or replace function public.get_profile_friend_count(target_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.friends f
  where f.status = 'accepted'
    and public.is_profile_visible(target_user_id)
    and (
      f.requester_id = target_user_id
      or f.addressee_id = target_user_id
    );
$$;

revoke all on function public.get_profile_friend_count(uuid) from public;
grant execute on function public.get_profile_friend_count(uuid) to anon, authenticated;

commit;
