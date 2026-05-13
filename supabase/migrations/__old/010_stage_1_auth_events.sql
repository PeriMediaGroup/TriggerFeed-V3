-- =========================================================
-- Stage 1: Auth Events
-- Logs signup/login/auth flow events for debugging and audit.
-- =========================================================

create table if not exists public.auth_events (
  id uuid primary key default gen_random_uuid(),

  user_id uuid references auth.users(id) on delete set null,
  email text,

  event_type text not null,
  success boolean not null default true,

  error_code text,
  error_message text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

alter table public.auth_events enable row level security;

grant insert on public.auth_events to anon, authenticated;
grant select on public.auth_events to authenticated;

drop policy if exists "Anyone can insert auth events"
on public.auth_events;

create policy "Anyone can insert auth events"
on public.auth_events
for insert
to anon, authenticated
with check (true);

drop policy if exists "Authenticated users can read their own auth events"
on public.auth_events;

create policy "Authenticated users can read their own auth events"
on public.auth_events
for select
to authenticated
using (
  auth.uid() = user_id
);

create index if not exists auth_events_user_id_idx
on public.auth_events(user_id);

create index if not exists auth_events_email_idx
on public.auth_events(email);

create index if not exists auth_events_event_type_idx
on public.auth_events(event_type);

create index if not exists auth_events_created_at_idx
on public.auth_events(created_at desc);