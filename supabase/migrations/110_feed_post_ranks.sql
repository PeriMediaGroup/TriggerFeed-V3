-- =========================================================
-- 110: Feed Post Ranks
-- =========================================================

begin;

create or replace function public.get_feed_post_ranks(p_post_ids uuid[])
returns table (
  post_id uuid,
  feed_rank integer
)
language sql
stable
security definer
set search_path = public
as $$
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

revoke all on function public.get_feed_post_ranks(uuid[]) from public;
grant execute on function public.get_feed_post_ranks(uuid[]) to anon, authenticated;

commit;
