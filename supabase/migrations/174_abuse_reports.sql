-- 174: Public Legal Abuse Reports
-- Separate from authenticated in-app post_reports.

begin;

create table if not exists public.abuse_reports (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  link text not null,
  offending_username text,
  details text not null,
  source text not null default 'triggerfeed-v3-legal',
  status text not null default 'new',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint abuse_reports_status_check
    check (status in ('new', 'reviewing', 'reviewed', 'dismissed', 'action_taken')),
  constraint abuse_reports_email_length_check
    check (char_length(email) <= 254),
  constraint abuse_reports_link_length_check
    check (char_length(link) <= 2048),
  constraint abuse_reports_offending_username_length_check
    check (offending_username is null or char_length(offending_username) <= 80),
  constraint abuse_reports_details_length_check
    check (char_length(details) between 10 and 4000),
  constraint abuse_reports_source_length_check
    check (char_length(source) <= 120)
);

create index if not exists abuse_reports_created_at_idx
  on public.abuse_reports(created_at desc);

create index if not exists abuse_reports_status_idx
  on public.abuse_reports(status);

create index if not exists abuse_reports_reviewed_by_idx
  on public.abuse_reports(reviewed_by);

create index if not exists abuse_reports_lower_email_idx
  on public.abuse_reports(lower(email));

create index if not exists abuse_reports_offending_username_idx
  on public.abuse_reports(offending_username)
  where offending_username is not null;

drop trigger if exists set_abuse_reports_updated_at on public.abuse_reports;
create trigger set_abuse_reports_updated_at
before update on public.abuse_reports
for each row
execute function public.set_updated_at();

alter table public.abuse_reports enable row level security;

revoke all on public.abuse_reports from anon;
revoke all on public.abuse_reports from authenticated;

grant select on public.abuse_reports to authenticated;
grant update (status, reviewed_by, reviewed_at, updated_at)
on public.abuse_reports to authenticated;

create or replace function public.is_admin_or_ceo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'ceo')
      and coalesce(p.is_banned, false) = false
      and coalesce(p.is_deleted, false) = false
  );
$$;

revoke all on function public.is_admin_or_ceo() from public;
grant execute on function public.is_admin_or_ceo() to authenticated;

drop policy if exists "Admin and CEO can read abuse reports"
on public.abuse_reports;

create policy "Admin and CEO can read abuse reports"
on public.abuse_reports
for select
to authenticated
using (public.is_admin_or_ceo());

drop policy if exists "Admin and CEO can update abuse report status"
on public.abuse_reports;

create policy "Admin and CEO can update abuse report status"
on public.abuse_reports
for update
to authenticated
using (public.is_admin_or_ceo())
with check (
  public.is_admin_or_ceo()
  and
  (
    reviewed_by is null
    or reviewed_by = auth.uid()
  )
);

commit;
