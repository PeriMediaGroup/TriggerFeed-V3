-- Lock down user_rank_thresholds
-- Users may read rank thresholds, but only admin/ceo can manage them.

alter table public.user_rank_thresholds enable row level security;

drop policy if exists "Authenticated users can read rank thresholds"
on public.user_rank_thresholds;

drop policy if exists "Admins can insert rank thresholds"
on public.user_rank_thresholds;

drop policy if exists "Admins can update rank thresholds"
on public.user_rank_thresholds;

drop policy if exists "Admins can delete rank thresholds"
on public.user_rank_thresholds;

create policy "Authenticated users can read rank thresholds"
on public.user_rank_thresholds
for select
to authenticated
using (true);

create policy "Admins can insert rank thresholds"
on public.user_rank_thresholds
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.role, 'user') in ('admin', 'ceo')
  )
);

create policy "Admins can update rank thresholds"
on public.user_rank_thresholds
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.role, 'user') in ('admin', 'ceo')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.role, 'user') in ('admin', 'ceo')
  )
);

create policy "Admins can delete rank thresholds"
on public.user_rank_thresholds
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.role, 'user') in ('admin', 'ceo')
  )
);