-- ============================================================
-- 091_fix_profiles_select_grants.sql
-- Allow authenticated users to read their own profile through RLS
-- ============================================================

grant select on public.profiles to authenticated;

alter table public.profiles enable row level security;

drop policy if exists "Users can read their own profile"
on public.profiles;

create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
);