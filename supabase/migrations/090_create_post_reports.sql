-- ============================================================
-- 090_create_post_reports.sql
-- Post Reports / Flagging Foundation
-- ============================================================

-- ------------------------------------------------------------
-- Table
-- ------------------------------------------------------------

create table if not exists public.post_reports (
  id uuid primary key default gen_random_uuid(),

  post_id uuid not null references public.posts(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,

  reason text not null,
  details text,

  status text not null default 'open',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint post_reports_reason_check
    check (
      reason in (
        'spam',
        'harassment',
        'threats',
        'illegal_content',
        'graphic_content',
        'scam',
        'other'
      )
    ),

  constraint post_reports_status_check
    check (
      status in (
        'open',
        'reviewed',
        'dismissed',
        'actioned'
      )
    ),

  constraint post_reports_details_length_check
    check (
      details is null or char_length(details) <= 1000
    ),

  constraint post_reports_unique_post_reporter
    unique (post_id, reporter_id)
);

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------

create index if not exists post_reports_post_id_idx
  on public.post_reports(post_id);

create index if not exists post_reports_reporter_id_idx
  on public.post_reports(reporter_id);

create index if not exists post_reports_status_idx
  on public.post_reports(status);

create index if not exists post_reports_created_at_idx
  on public.post_reports(created_at desc);

create index if not exists post_reports_post_status_idx
  on public.post_reports(post_id, status);

-- ------------------------------------------------------------
-- updated_at trigger
-- ------------------------------------------------------------

create or replace function public.set_post_reports_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_post_reports_updated_at on public.post_reports;

create trigger set_post_reports_updated_at
before update on public.post_reports
for each row
execute function public.set_post_reports_updated_at();

-- ------------------------------------------------------------
-- Grants
-- ------------------------------------------------------------

revoke all on public.post_reports from anon;
grant select, insert, update on public.post_reports to authenticated;

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------

alter table public.post_reports enable row level security;

-- Users can create their own reports only.
drop policy if exists "Users can create their own post reports"
on public.post_reports;

create policy "Users can create their own post reports"
on public.post_reports
for insert
to authenticated
with check (
  reporter_id = auth.uid()
  and status = 'open'
  and reviewed_by is null
  and reviewed_at is null
);

-- Users can read their own reports.
drop policy if exists "Users can read their own post reports"
on public.post_reports;

create policy "Users can read their own post reports"
on public.post_reports
for select
to authenticated
using (
  reporter_id = auth.uid()
);

-- Admins and CEO can read all reports.
drop policy if exists "Admins and CEO can read all post reports"
on public.post_reports;

create policy "Admins and CEO can read all post reports"
on public.post_reports
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'ceo')
      and coalesce(p.is_banned, false) = false
      and coalesce(p.is_deleted, false) = false
  )
);

-- Admins and CEO can update reports.
drop policy if exists "Admins and CEO can update post reports"
on public.post_reports;

create policy "Admins and CEO can update post reports"
on public.post_reports
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'ceo')
      and coalesce(p.is_banned, false) = false
      and coalesce(p.is_deleted, false) = false
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'ceo')
      and coalesce(p.is_banned, false) = false
      and coalesce(p.is_deleted, false) = false
  )
);

-- ------------------------------------------------------------
-- Notes:
-- No delete policy.
-- Reports are moderation/audit records and should not be deleted
-- from the client app. If cleanup is ever needed, do it through
-- service-role maintenance.
-- ------------------------------------------------------------