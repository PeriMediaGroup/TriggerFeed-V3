select id, type, is_read, read_at, dismissed_at
from public.notifications
order by created_at desc;