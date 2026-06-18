begin;

-- post_vote_counts is an aggregate-only view, but clients should not access
-- public-schema views directly. Expose the aggregate shape through a narrow RPC.
create or replace function public.get_post_vote_counts(p_post_ids uuid[])
returns table (
  post_id uuid,
  upvote_count integer,
  downvote_count integer,
  score integer,
  vote_score integer,
  vote_count integer,
  interaction_count integer
)
language sql
stable
security definer
set search_path = public
as $$
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

revoke all on function public.get_post_vote_counts(uuid[]) from public;
grant execute on function public.get_post_vote_counts(uuid[]) to anon, authenticated;

revoke all privileges on table public.post_vote_counts from public;
revoke all privileges on table public.post_vote_counts from anon;
revoke all privileges on table public.post_vote_counts from authenticated;

commit;
