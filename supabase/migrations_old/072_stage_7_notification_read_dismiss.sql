-- =========================================================
-- Stage 7.2: Notification read/dismiss support
--
-- read_at:
-- - tracks when the notification was seen/read
--
-- dismissed_at:
-- - soft-hides handled notifications without deleting history
-- =========================================================

alter table public.notifications
add column if not exists read_at timestamptz,
add column if not exists dismissed_at timestamptz;

update public.notifications
set read_at = created_at
where is_read = true
and read_at is null;