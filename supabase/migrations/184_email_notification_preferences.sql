-- 184: Email Notification Preferences

begin;

alter table public.notification_settings
  add column if not exists email_enabled boolean not null default true,
  add column if not exists email_comments boolean not null default true,
  add column if not exists email_mentions boolean not null default true,
  add column if not exists email_friend_requests boolean not null default true,
  add column if not exists email_friend_accepted boolean not null default true,
  add column if not exists email_announcements boolean not null default true,
  add column if not exists email_marketing boolean not null default false;

create index if not exists notification_settings_service_announcements_idx
on public.notification_settings (user_id)
where email_enabled = true
  and email_announcements = true;

create index if not exists notification_settings_marketing_email_idx
on public.notification_settings (user_id)
where email_enabled = true
  and email_marketing = true;

commit;
