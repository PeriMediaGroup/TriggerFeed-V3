-- =========================================================
-- 111: CEO Sticky Posts
-- =========================================================

begin;

alter table public.posts
  add column if not exists is_sticky boolean not null default false,
  add column if not exists sticky_at timestamptz,
  add column if not exists sticky_by uuid references public.profiles(id) on delete set null;

alter table public.posts
  drop constraint if exists posts_sticky_metadata_check;

alter table public.posts
  add constraint posts_sticky_metadata_check
  check (
    (
      is_sticky = true
      and sticky_at is not null
      and sticky_by is not null
    )
    or
    (
      is_sticky = false
      and sticky_at is null
      and sticky_by is null
    )
  );

create index if not exists posts_sticky_feed_idx
on public.posts (is_sticky desc, sticky_at desc, created_at desc)
where is_deleted = false and visibility = 'public';

create or replace function public.current_user_is_ceo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'ceo'
        and coalesce(p.is_banned, false) = false
        and coalesce(p.is_deleted, false) = false
    );
$$;

revoke all on function public.current_user_is_ceo() from public;
grant execute on function public.current_user_is_ceo() to authenticated;

create or replace function public.enforce_ceo_sticky_post_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.is_sticky, false) = true then
    if not public.current_user_is_ceo() then
      raise exception 'CEO permission required to set sticky post status';
    end if;

    new.sticky_at := coalesce(new.sticky_at, now());
    new.sticky_by := coalesce(new.sticky_by, auth.uid());
  else
    new.is_sticky := false;
    new.sticky_at := null;
    new.sticky_by := null;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_ceo_sticky_post_fields() from public;

drop trigger if exists enforce_ceo_sticky_post_fields_trigger
on public.posts;

drop trigger if exists prevent_non_ceo_sticky_post_update_trigger
on public.posts;

drop trigger if exists prevent_non_ceo_sticky_post_write_trigger
on public.posts;

create trigger enforce_ceo_sticky_post_fields_trigger
before insert or update
on public.posts
for each row
execute function public.enforce_ceo_sticky_post_fields();

commit;
