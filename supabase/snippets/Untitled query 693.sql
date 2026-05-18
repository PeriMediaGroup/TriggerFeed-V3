select
  schemaname,
  tablename,
  policyname,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('polls', 'poll_options', 'poll_responses')
order by tablename, policyname;