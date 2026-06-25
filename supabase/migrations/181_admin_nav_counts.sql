-- =========================================================
-- 181: Admin Navigation Counts
-- =========================================================

begin;

create or replace function public.get_admin_nav_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_reports integer := 0;
  v_abuse_reports integer := 0;
  v_reviews integer := 0;
  v_total integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_moderator_or_above() then
    raise exception 'Moderator permission required';
  end if;

  select count(*)::integer
  into v_reports
  from public.post_reports pr
  where pr.status in (
    'pending',
    'under_review',
    'escalated',
    -- Current legacy report status used by the existing moderation UI.
    'open'
  );

  if public.is_admin_or_above()
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

  if to_regclass('public.moderation_reviews') is not null then
    execute
      'select count(*)::integer
       from public.moderation_reviews mr
       where mr.status in (''pending'', ''under_review'', ''escalated'')'
    into v_reviews;
  end if;

  v_total := v_reports + v_abuse_reports + v_reviews;

  return jsonb_build_object(
    'reports', v_reports,
    'abuseReports', v_abuse_reports,
    'reviews', v_reviews,
    'total', v_total
  );
end;
$$;

revoke all on function public.get_admin_nav_counts() from public;
grant execute on function public.get_admin_nav_counts() to authenticated;

commit;
