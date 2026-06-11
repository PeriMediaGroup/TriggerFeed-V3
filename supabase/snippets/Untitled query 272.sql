select
  user_id,
  type,
  title,
  body,
  metadata,
  is_read,
  created_at
from public.notifications
where type in (
  'account_muted',
  'account_banned',
  'account_unmuted',
  'account_unbanned'
)
order by created_at desc
limit 10;