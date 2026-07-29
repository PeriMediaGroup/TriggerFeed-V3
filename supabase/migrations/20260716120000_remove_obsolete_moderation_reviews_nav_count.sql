-- Remove obsolete moderation_reviews dependency from admin navigation counts.
-- TriggerFeed V3 has no moderation_reviews relation; reports and abuse reports
-- remain the current admin navigation count sources.

begin;

create or replace function public.get_admin_nav_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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
      'new',
      'reviewing'
    );
  end if;

  -- No moderation review or role-review tables exist in the current V3 schema.
  v_reviews := 0;
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

revoke all on function public.get_admin_nav_counts() from public;
grant execute on function public.get_admin_nav_counts() to authenticated;

commit;
