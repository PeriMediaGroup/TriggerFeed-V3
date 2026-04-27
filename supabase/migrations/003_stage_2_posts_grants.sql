-- Allow authenticated users to use the public schema
grant usage on schema public to authenticated;
grant usage on schema public to anon;

-- Posts table permissions
grant select on public.posts to anon;
grant select on public.posts to authenticated;
grant insert on public.posts to authenticated;
grant update on public.posts to authenticated;

-- Audit log insert permissions
grant insert on public.post_audit_logs to authenticated;

-- Lock down audit logs with RLS
alter table public.post_audit_logs enable row level security;

drop policy if exists "Authenticated users can insert their own post audit logs"
on public.post_audit_logs;

create policy "Authenticated users can insert their own post audit logs"
on public.post_audit_logs
for insert
to authenticated
with check (
  auth.uid() = user_id
);