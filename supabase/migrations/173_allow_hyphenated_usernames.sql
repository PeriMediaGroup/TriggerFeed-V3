-- =========================================================
-- 173: Allow Hyphenated Usernames
-- =========================================================

begin;

alter table public.profiles
  drop constraint if exists profiles_username_format_check;

alter table public.profiles
  add constraint profiles_username_format_check
  check (username is null or username ~ '^[A-Za-z0-9_-]+$');

commit;
