param(
    [string]$LocalDbUrl = "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    [string]$DumpDir = "migration-dumps"
)

$ErrorActionPreference = "Stop"

function Write-Step($Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Invoke-Native($Description, $Command, $Arguments) {
    Write-Step $Description
    & $Command @Arguments

    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed with exit code $LASTEXITCODE"
    }
}

if (-not $env:OLD_TRIGGERFEED_DB_URL) {
    throw "OLD_TRIGGERFEED_DB_URL is not set. Set it before running this script."
}

if ($env:OLD_TRIGGERFEED_DB_URL -match "YOUR_|HOST|PASSWORD") {
    throw "OLD_TRIGGERFEED_DB_URL still looks like a placeholder. Nice try, chaos gremlin."
}

New-Item -ItemType Directory -Force -Path $DumpDir | Out-Null

$oldCommentsCsv = Join-Path $DumpDir "old-comments.csv"

Write-Step "Export old comments"
$env:PGCLIENTENCODING = "UTF8"

Invoke-Native "Export old comments CSV" "psql" @(
    $env:OLD_TRIGGERFEED_DB_URL,
    "-c",
    "\copy (
    select
      id,
      user_id,
      post_id,
      text,
      created_at,
      parent_id,
      image_url,
      updated_at
    from public.comments
    order by created_at, id
  ) to '$oldCommentsCsv' with csv header"
)

if (-not (Test-Path $oldCommentsCsv)) {
    throw "Expected comments export was not created: $oldCommentsCsv"
}

$commentLineCount = (Get-Content $oldCommentsCsv | Measure-Object -Line).Lines

if ($commentLineCount -le 1) {
    throw "Comments export is empty. Not importing a whole lot of nothing."
}

Write-Host "Exported comment CSV lines: $commentLineCount"

Invoke-Native "Create comments staging table" "psql" @(
    $LocalDbUrl,
    "-c",
    "
  drop table if exists public.migration_old_comments;

  create table public.migration_old_comments (
    id uuid primary key,
    user_id uuid,
    post_id uuid,
    text text,
    created_at timestamp without time zone,
    parent_id uuid,
    image_url text,
    updated_at timestamp without time zone
  );
  "
)

Invoke-Native "Import comments into staging" "psql" @(
    $LocalDbUrl,
    "-c",
    "\copy public.migration_old_comments (
    id,
    user_id,
    post_id,
    text,
    created_at,
    parent_id,
    image_url,
    updated_at
  ) from '$oldCommentsCsv' with csv header"
)

Invoke-Native "Validate staged comments" "psql" @(
    $LocalDbUrl,
    "-c",
    "

select count(*) as replies_to_replies_that_will_be_flattened
from public.migration_old_comments child
join public.migration_old_comments parent
  on parent.id = child.parent_id
where parent.parent_id is not null;

  select count(*) as staged_comments
  from public.migration_old_comments;

  select count(*) as comments_without_local_posts
  from public.migration_old_comments c
  left join public.posts p
    on p.id = c.post_id
  where p.id is null;

  select count(*) as comments_without_local_profiles
  from public.migration_old_comments c
  left join public.profiles p
    on p.id = c.user_id
  where p.id is null;

  select count(*) as replies_without_parent
  from public.migration_old_comments c
  left join public.migration_old_comments parent
    on parent.id = c.parent_id
  where c.parent_id is not null
    and parent.id is null;

  select count(*) as comments_with_images
  from public.migration_old_comments
  where nullif(trim(image_url), '') is not null;
  "
)

Invoke-Native "Delete existing migrated comments" "psql" @(
    $LocalDbUrl,
    "-c",
    "
  delete from public.comments c
  using public.migration_old_comments old
  where c.id = old.id;
  "
)

Invoke-Native "Insert migrated comments" "psql" @(
  $LocalDbUrl,
  "-c",
  "
  -- Insert top-level comments first.
  insert into public.comments (
    id,
    post_id,
    user_id,
    parent_comment_id,
    body,
    is_deleted,
    deleted_at,
    created_at,
    updated_at
  )
  select
    old.id,
    old.post_id,
    old.user_id,
    null as parent_comment_id,

    case
      when nullif(trim(old.text), '') is not null
        and nullif(trim(old.image_url), '') is not null
        then trim(old.text) || E'\n\n[Legacy comment image: ' || trim(old.image_url) || ']'

      when nullif(trim(old.text), '') is not null
        then trim(old.text)

      when nullif(trim(old.image_url), '') is not null
        then '[Migrated legacy image comment: ' || trim(old.image_url) || ']'

      else 'Migrated legacy comment'
    end as body,

    false as is_deleted,
    null as deleted_at,
    coalesce(old.created_at, now())::timestamptz as created_at,
    coalesce(old.updated_at, old.created_at, now())::timestamptz as updated_at

  from public.migration_old_comments old
  join public.posts p
    on p.id = old.post_id
  join public.profiles pr
    on pr.id = old.user_id
  where old.parent_id is null
  order by old.created_at, old.id

  on conflict (id) do update
  set
    post_id = excluded.post_id,
    user_id = excluded.user_id,
    parent_comment_id = excluded.parent_comment_id,
    body = excluded.body,
    is_deleted = excluded.is_deleted,
    deleted_at = excluded.deleted_at,
    created_at = excluded.created_at,
    updated_at = excluded.updated_at;

  -- Insert replies second, flattened to the top-level parent.
  with recursive parent_walk as (
    select
      child.id as comment_id,
      child.parent_id as ancestor_id,
      parent.parent_id as ancestor_parent_id
    from public.migration_old_comments child
    join public.migration_old_comments parent
      on parent.id = child.parent_id
    where child.parent_id is not null

    union all

    select
      walk.comment_id,
      parent.id as ancestor_id,
      parent.parent_id as ancestor_parent_id
    from parent_walk walk
    join public.migration_old_comments parent
      on parent.id = walk.ancestor_parent_id
    where walk.ancestor_parent_id is not null
  ),
  flattened_reply_parent as (
    select
      comment_id,
      ancestor_id as top_level_parent_id
    from parent_walk
    where ancestor_parent_id is null
  )
  insert into public.comments (
    id,
    post_id,
    user_id,
    parent_comment_id,
    body,
    is_deleted,
    deleted_at,
    created_at,
    updated_at
  )
  select
    old.id,
    old.post_id,
    old.user_id,
    flat.top_level_parent_id as parent_comment_id,

    case
      when nullif(trim(old.text), '') is not null
        and nullif(trim(old.image_url), '') is not null
        then trim(old.text) || E'\n\n[Legacy comment image: ' || trim(old.image_url) || ']'

      when nullif(trim(old.text), '') is not null
        then trim(old.text)

      when nullif(trim(old.image_url), '') is not null
        then '[Migrated legacy image comment: ' || trim(old.image_url) || ']'

      else 'Migrated legacy comment'
    end as body,

    false as is_deleted,
    null as deleted_at,
    coalesce(old.created_at, now())::timestamptz as created_at,
    coalesce(old.updated_at, old.created_at, now())::timestamptz as updated_at

  from public.migration_old_comments old
  join flattened_reply_parent flat
    on flat.comment_id = old.id
  join public.posts p
    on p.id = old.post_id
  join public.profiles pr
    on pr.id = old.user_id
  join public.comments top_parent
    on top_parent.id = flat.top_level_parent_id
   and top_parent.parent_comment_id is null
  where old.parent_id is not null
  order by old.created_at, old.id

  on conflict (id) do update
  set
    post_id = excluded.post_id,
    user_id = excluded.user_id,
    parent_comment_id = excluded.parent_comment_id,
    body = excluded.body,
    is_deleted = excluded.is_deleted,
    deleted_at = excluded.deleted_at,
    created_at = excluded.created_at,
    updated_at = excluded.updated_at;
  "
)

Invoke-Native "Validate migrated comments" "psql" @(
    $LocalDbUrl,
    "-c",
    "
  select
    (select count(*) from public.migration_old_comments) as staged_comments,
    (select count(*) from public.comments c join public.migration_old_comments old on old.id = c.id) as migrated_comments,
    (
      select count(*)
      from public.comments c
      join public.migration_old_comments old on old.id = c.id
      where c.parent_comment_id is not null
    ) as migrated_replies;

  select count(*) as comments_without_posts
  from public.comments c
  join public.migration_old_comments old on old.id = c.id
  left join public.posts p on p.id = c.post_id
  where p.id is null;

  select count(*) as comments_without_profiles
  from public.comments c
  join public.migration_old_comments old on old.id = c.id
  left join public.profiles p on p.id = c.user_id
  where p.id is null;

  select
    c.id,
    pr.username,
    left(c.body, 100) as body_sample,
    c.parent_comment_id,
    c.created_at
  from public.comments c
  join public.migration_old_comments old on old.id = c.id
  join public.profiles pr on pr.id = c.user_id
  order by c.created_at desc
  limit 10;
  "
)

Write-Host ""
Write-Host "Comment migration complete." -ForegroundColor Green
