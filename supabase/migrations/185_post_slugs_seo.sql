-- 185: Post Slugs and SEO Discovery

begin;

alter table public.posts
  add column if not exists slug text;

create unique index if not exists posts_slug_unique_idx
on public.posts (slug)
where slug is not null;

create index if not exists posts_slug_lookup_idx
on public.posts (slug)
where slug is not null
  and is_deleted = false
  and visibility = 'public';

create or replace function public.normalize_post_slug(p_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(
    trim(
      both '-' from regexp_replace(
        regexp_replace(
          regexp_replace(lower(trim(coalesce(p_value, ''))), '[^a-z0-9]+', '-', 'g'),
          '-+',
          '-',
          'g'
        ),
        '^-|-$',
        '',
        'g'
      )
    ),
    ''
  );
$$;

create or replace function public.generate_unique_post_slug(
  p_title text,
  p_post_id uuid default null
)
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  v_base text := public.normalize_post_slug(p_title);
  v_candidate text;
  v_suffix integer := 2;
begin
  if v_base is null then
    return null;
  end if;

  v_candidate := v_base;

  while
    v_candidate in ('new')
    or v_candidate ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or exists (
      select 1
      from public.posts p
      where p.slug = v_candidate
        and (p_post_id is null or p.id <> p_post_id)
    )
  loop
    v_candidate := v_base || '-' || v_suffix::text;
    v_suffix := v_suffix + 1;
  end loop;

  return v_candidate;
end;
$$;

create or replace function public.set_post_slug()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.slug is not null then
    new.slug := old.slug;
    return new;
  end if;

  if nullif(trim(coalesce(new.title, '')), '') is null then
    new.slug := null;
    return new;
  end if;

  if new.slug is null or public.normalize_post_slug(new.slug) is null then
    new.slug := public.generate_unique_post_slug(new.title, new.id);
  else
    new.slug := public.generate_unique_post_slug(new.slug, new.id);
  end if;

  return new;
end;
$$;

do $$
declare
  v_post record;
begin
  for v_post in
    select p.id, p.title
    from public.posts p
    where p.slug is null
      and coalesce(p.is_deleted, false) = false
      and p.visibility = 'public'
      and nullif(trim(coalesce(p.title, '')), '') is not null
    order by p.created_at asc, p.id asc
  loop
    update public.posts
    set slug = public.generate_unique_post_slug(v_post.title, v_post.id)
    where id = v_post.id;
  end loop;
end;
$$;

drop trigger if exists set_post_slug_before_insert_update on public.posts;
create trigger set_post_slug_before_insert_update
before insert or update of title, slug
on public.posts
for each row
execute function public.set_post_slug();

create or replace function public.get_post_reports_for_moderation()
returns table (
  id uuid,
  post_id uuid,
  reporter_id uuid,
  reason text,
  details text,
  status text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  post jsonb,
  reporter jsonb,
  reviewer jsonb,
  post_author jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_moderator_or_above() then
    raise exception 'Moderator permission required';
  end if;

  return query
  select
    pr.id,
    pr.post_id,
    pr.reporter_id,
    pr.reason,
    pr.details,
    pr.status,
    pr.reviewed_by,
    pr.reviewed_at,
    pr.created_at,
    pr.updated_at,
    case
      when p.id is null then null
      else jsonb_build_object(
        'id', p.id,
        'slug', p.slug,
        'title', p.title,
        'body', p.body,
        'user_id', p.user_id,
        'visibility', p.visibility,
        'is_deleted', p.is_deleted,
        'deleted_at', p.deleted_at,
        'removed_at', p.removed_at,
        'removed_by', p.removed_by,
        'removal_reason', p.removal_reason,
        'restored_at', p.restored_at,
        'restored_by', p.restored_by,
        'created_at', p.created_at
      )
    end as post,
    case
      when reporter.id is null then null
      else jsonb_build_object(
        'id', reporter.id,
        'username', reporter.username,
        'display_name', reporter.display_name,
        'first_name', reporter.first_name,
        'last_name', reporter.last_name,
        'avatar_cloudinary_url', reporter.avatar_cloudinary_url,
        'profile_badge', reporter.profile_badge,
        'role', reporter.role,
        'is_banned', coalesce(reporter.is_banned, false),
        'is_muted', coalesce(reporter.is_muted, false),
        'is_deleted', coalesce(reporter.is_deleted, false)
      )
    end as reporter,
    case
      when reviewer.id is null then null
      else jsonb_build_object(
        'id', reviewer.id,
        'username', reviewer.username,
        'display_name', reviewer.display_name,
        'first_name', reviewer.first_name,
        'last_name', reviewer.last_name,
        'avatar_cloudinary_url', reviewer.avatar_cloudinary_url,
        'profile_badge', reviewer.profile_badge,
        'role', reviewer.role,
        'is_banned', coalesce(reviewer.is_banned, false),
        'is_muted', coalesce(reviewer.is_muted, false),
        'is_deleted', coalesce(reviewer.is_deleted, false)
      )
    end as reviewer,
    case
      when author.id is null then null
      else jsonb_build_object(
        'id', author.id,
        'username', author.username,
        'display_name', author.display_name,
        'first_name', author.first_name,
        'last_name', author.last_name,
        'avatar_cloudinary_url', author.avatar_cloudinary_url,
        'profile_badge', author.profile_badge,
        'role', author.role,
        'is_banned', coalesce(author.is_banned, false),
        'is_muted', coalesce(author.is_muted, false),
        'is_deleted', coalesce(author.is_deleted, false)
      )
    end as post_author
  from public.post_reports pr
  left join public.posts p
    on p.id = pr.post_id
  left join public.profiles reporter
    on reporter.id = pr.reporter_id
  left join public.profiles reviewer
    on reviewer.id = pr.reviewed_by
  left join public.profiles author
    on author.id = p.user_id
  order by pr.created_at desc;
end;
$$;

revoke all on function public.get_post_reports_for_moderation() from public;
grant execute on function public.get_post_reports_for_moderation() to authenticated;

revoke all on function public.normalize_post_slug(text) from public;
revoke all on function public.generate_unique_post_slug(text, uuid) from public;
revoke all on function public.set_post_slug() from public;

commit;
