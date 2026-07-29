# scripts/migration/import-current-posts-remote.ps1
# TriggerFeed V3 Remote Posts + Media Migration
#
# Imports current legacy TriggerFeed posts into REMOTE V3 Supabase.
# Generates V3 post_media rows from old posts.image_url / gif_url / video_url.
#
# Requirements:
# - Remote users/profiles already migrated
# - OLD_TRIGGERFEED_DB_URL set in this PowerShell session
# - TRIGGERFEED_V3_DB_URL set in this PowerShell session
# - psql available
#
# Usage:
#   $env:OLD_TRIGGERFEED_DB_URL="postgresql://<legacy-user>:<legacy-password>@<legacy-host>:5432/<legacy-database>"
#   $env:TRIGGERFEED_V3_DB_URL="postgresql://<v3-user>:<v3-password>@<v3-host>:5432/<v3-database>"
#   .\scripts\migration\import-current-posts-remote.ps1 -DryRun
#   .\scripts\migration\import-current-posts-remote.ps1 -ConfirmProductionImport

param(
    [switch]$ConfirmProductionImport,
    [switch]$DryRun,
    [string]$DumpDir = ".\migration-dumps"
)

$ErrorActionPreference = "Stop"

$HelperPath = Join-Path $PSScriptRoot "lib\MigrationSafety.psm1"
Import-Module $HelperPath -Force -DisableNameChecking

Require-MigrationCommand "psql"

$SourceDbUrl = Require-MigrationEnvVar "OLD_TRIGGERFEED_DB_URL"
$TargetDbUrl = Require-MigrationEnvVar "TRIGGERFEED_V3_DB_URL"
Assert-RemoteTargetDbUrl -TargetDbUrl $TargetDbUrl

Write-MigrationStep "Validated remote posts import settings"
Write-Host "Source: $(Get-RedactedDbLabel $SourceDbUrl)"
Write-Host "Target: $(Get-RedactedDbLabel $TargetDbUrl)"

Confirm-ProductionImport -Confirmed:$ConfirmProductionImport.IsPresent -DryRun:$DryRun.IsPresent
if ($DryRun) {
    exit 0
}

New-Item -ItemType Directory -Force $DumpDir | Out-Null

$PostsCsv = Join-Path $DumpDir "old-posts.csv"
$PostsCsvForPsql = $PostsCsv.Replace('\', '/')

$env:PGCLIENTENCODING = "UTF8"

Write-Step "Testing old production DB connection"
Invoke-Native "Old production posts count" "psql" @(
    $SourceDbUrl,
    "-c",
    "select count(*) as old_posts from public.posts;"
)

Write-Step "Testing remote V3 DB connection"
Invoke-Native "Remote V3 profile count" "psql" @(
    $TargetDbUrl,
    "-c",
    "select count(*) as local_profiles from public.profiles;"
)

Write-Step "Checking remote auth/profile migration exists"
$LocalProfileCount = & psql $TargetDbUrl -t -A -c "select count(*) from public.profiles;"
if ($LASTEXITCODE -ne 0) {
    throw "Could not check remote profiles."
}
$LocalProfileCount = $LocalProfileCount.Trim()

if ([int]$LocalProfileCount -le 0) {
    throw "Remote profiles count is 0. Run import-current-users-remote.ps1 first."
}

Write-Host "Remote profiles found: $LocalProfileCount" -ForegroundColor Green

Write-Step "Exporting old production posts as UTF-8 CSV"

if (Test-Path $PostsCsv) {
    Remove-Item $PostsCsv -Force
}

Invoke-Native "Export old posts" "psql" @(
    $SourceDbUrl,
    "-c",
    "\copy (
        select
          id,
          user_id,
          title,
          description,
          image_url,
          visibility,
          created_at,
          sticky,
          post_type,
          poll_id,
          comments_locked,
          shared_with,
          gif_url,
          flagged,
          video_url
        from public.posts
        order by created_at
    ) to '$PostsCsvForPsql' with csv header"
)

if (-not (Test-Path $PostsCsv)) {
    throw "Posts CSV was not created at $PostsCsv"
}

$PostCsvLines = (Get-Content $PostsCsv | Measure-Object -Line).Lines
if ($PostCsvLines -le 1) {
    throw "Posts CSV has no data rows. Lines found: $PostCsvLines"
}

Write-Host "Post CSV rows including header: $PostCsvLines" -ForegroundColor Green

Write-Step "Creating old posts staging table"
Invoke-Native "Create migration_old_posts" "psql" @(
    $TargetDbUrl,
    "-c",
    "
    drop table if exists public.migration_old_posts;

    create table public.migration_old_posts (
      id uuid,
      user_id uuid,
      title text,
      description text,
      image_url text,
      visibility text,
      created_at timestamp without time zone,
      sticky boolean,
      post_type text,
      poll_id uuid,
      comments_locked boolean,
      shared_with text[],
      gif_url text,
      flagged boolean,
      video_url text
    );
    "
)

Write-Step "Loading old posts into staging"
Invoke-Native "Copy old posts CSV into staging" "psql" @(
    $TargetDbUrl,
    "-c",
    "\copy public.migration_old_posts from '$PostsCsvForPsql' with csv header"
)

$StagingPostCount = & psql $TargetDbUrl -t -A -c "select count(*) from public.migration_old_posts;"
if ($LASTEXITCODE -ne 0) {
    throw "Could not check staging post count."
}
$StagingPostCount = $StagingPostCount.Trim()

if ([int]$StagingPostCount -le 0) {
    throw "Post staging import failed. migration_old_posts has 0 rows."
}

Write-Host "Post staging rows: $StagingPostCount" -ForegroundColor Green

Write-Step "Checking staged posts without matching remote profiles"
$OrphanPostCount = & psql $TargetDbUrl -t -A -c "
select count(*)
from public.migration_old_posts p
left join public.profiles pr on pr.id = p.user_id
where pr.id is null;
"
if ($LASTEXITCODE -ne 0) {
    throw "Could not check orphan posts."
}
$OrphanPostCount = $OrphanPostCount.Trim()

if ([int]$OrphanPostCount -gt 0) {
    throw "Found $OrphanPostCount staged posts without matching remote profiles. Stop and fix users/profiles first."
}

Write-Host "Staged posts all have matching remote profiles." -ForegroundColor Green

Write-Step "Upserting old posts into V3 posts"
Invoke-Native "Upsert posts" "psql" @(
    $TargetDbUrl,
    "-c",
    "
    insert into public.posts (
      id,
      user_id,
      title,
      body,
      visibility,
      is_deleted,
      deleted_at,
      created_at,
      updated_at,
      is_sticky,
      sticky_at,
      sticky_by,
      removed_at,
      removed_by,
      removal_reason,
      restored_at,
      restored_by
    )
    select
      old.id,
      old.user_id,

      nullif(trim(old.title), '') as title,

      case
        when nullif(trim(old.description), '') is not null
          then nullif(trim(old.description), '')

        when nullif(trim(old.image_url), '') is not null
          or nullif(trim(old.gif_url), '') is not null
          or nullif(trim(old.video_url), '') is not null
          then 'Migrated media post'

        else 'Migrated legacy post'
      end as body,

      case
        when lower(trim(coalesce(old.visibility, 'public'))) in ('public', 'friends', 'private')
          then lower(trim(coalesce(old.visibility, 'public')))
        else 'public'
      end as visibility,

      false as is_deleted,
      null as deleted_at,

      coalesce(old.created_at::timestamptz, now()) as created_at,
      now() as updated_at,

      coalesce(old.sticky, false) as is_sticky,

      case
        when coalesce(old.sticky, false)
          then coalesce(old.created_at::timestamptz, now())
        else null
      end as sticky_at,

      null as sticky_by,

      case
        when coalesce(old.flagged, false)
          then coalesce(old.created_at::timestamptz, now())
        else null
      end as removed_at,

      null as removed_by,

      case
        when coalesce(old.flagged, false)
          then 'Migrated from legacy flagged post'
        else null
      end as removal_reason,

      null as restored_at,
      null as restored_by

    from public.migration_old_posts old
    join public.profiles p
      on p.id = old.user_id

    on conflict (id) do update set
      user_id = excluded.user_id,
      title = excluded.title,
      body = excluded.body,
      visibility = excluded.visibility,
      is_deleted = excluded.is_deleted,
      deleted_at = excluded.deleted_at,
      created_at = excluded.created_at,
      updated_at = now(),
      is_sticky = excluded.is_sticky,
      sticky_at = excluded.sticky_at,
      sticky_by = excluded.sticky_by,
      removed_at = excluded.removed_at,
      removed_by = excluded.removed_by,
      removal_reason = excluded.removal_reason,
      restored_at = excluded.restored_at,
      restored_by = excluded.restored_by;
    "
)

Write-Step "Removing previously generated legacy media rows for these posts"
Invoke-Native "Delete generated legacy media rows" "psql" @(
    $TargetDbUrl,
    "-c",
    "
    delete from public.post_media pm
    using public.migration_old_posts old
    where pm.post_id = old.id
      and pm.source = 'legacy_migration';
    "
)

Write-Step "Generating V3 post_media rows from old image/gif/video URLs"
Invoke-Native "Insert generated post_media rows" "psql" @(
    $TargetDbUrl,
    "-c",
    "
    with media_source as (
      select
        old.id as post_id,
        old.user_id,
        0 as sort_order,
        'image'::text as media_type,
        old.image_url as raw_url
      from public.migration_old_posts old
      where nullif(trim(old.image_url), '') is not null

      union all

      select
        old.id as post_id,
        old.user_id,
        1 as sort_order,
        'gif'::text as media_type,
        old.gif_url as raw_url
      from public.migration_old_posts old
      where nullif(trim(old.gif_url), '') is not null

      union all

      select
        old.id as post_id,
        old.user_id,
        2 as sort_order,
        'video'::text as media_type,
        old.video_url as raw_url
      from public.migration_old_posts old
      where nullif(trim(old.video_url), '') is not null
    ),
    decoded as (
      select
        post_id,
        user_id,
        sort_order,
        sort_order as display_order,
        media_type,
        trim(raw_url) as raw_url,
        case
          when trim(raw_url) ~ '^\\x[0-9A-Fa-f]+$'
            then convert_from(decode(substr(trim(raw_url), 3), 'hex'), 'UTF8')
          else trim(raw_url)
        end as decoded_url
      from media_source
    ),
    normalized as (
      select
        post_id,
        user_id,
        sort_order,
        display_order,
        media_type,

        case
          when decoded_url ilike 'http%' then decoded_url

          -- Legacy Cloudinary fetch fragments from old image_url exports.
          -- Example decoded value starts with:
          -- q_auto,f_auto,w_1080/https%3A%2F%2Fres.cloudinary.com...
          when decoded_url ilike 'q_auto,%/http%' then
            'https://res.cloudinary.com/triggerfeed/image/fetch/' || decoded_url

          else decoded_url
        end as url
      from decoded
    ),
    classified as (
      select
        post_id,
        user_id,
        sort_order,
        display_order,
        media_type,
        url,
        case
          when media_type in ('image', 'video')
            and url ilike '%cloudinary.com/%'
            then 'cloudinary'

          when media_type = 'gif'
            and url ilike 'http%'
            then 'giphy'

          else 'invalid'
        end as provider
      from normalized
      where nullif(trim(url), '') is not null
    ),
    prepared as (
      select
        *,
        case
          when provider = 'cloudinary'
            and url ~ '/upload/(v[0-9]+/)?'
            then regexp_replace(
              regexp_replace(url, '^.*?/upload/(v[0-9]+/)?', ''),
              '\.[A-Za-z0-9]+(\?.*)?$',
              ''
            )

          when provider = 'cloudinary'
            and url ~ '/fetch/'
            then 'legacy_fetch_' || md5(url)

          when provider = 'cloudinary'
            then 'legacy_' || md5(url)

          else null
        end as derived_cloudinary_public_id
      from classified
    )
    insert into public.post_media (
      id,
      post_id,
      user_id,
      media_type,
      provider,
      source,
      cloudinary_url,
      cloudinary_secure_url,
      cloudinary_public_id,
      external_id,
      external_url,
      thumbnail_url,
      title,
      original_filename,
      mime_type,
      file_size_bytes,
      width,
      height,
      format,
      alt_text,
      sort_order,
      display_order,
      created_at
    )
    select
      gen_random_uuid() as id,
      p.post_id,
      p.user_id,
      p.media_type,
      p.provider,
      'legacy_migration' as source,

      case when p.provider = 'cloudinary' then p.url else null end as cloudinary_url,
      case when p.provider = 'cloudinary' then p.url else null end as cloudinary_secure_url,
      case when p.provider = 'cloudinary' then p.derived_cloudinary_public_id else null end as cloudinary_public_id,

      null as external_id,

      case when p.provider = 'giphy' then p.url else null end as external_url,

      null as thumbnail_url,
      null as title,
      null as original_filename,

      case
        when p.media_type = 'image' then 'image/*'
        when p.media_type = 'gif' then 'image/gif'
        when p.media_type = 'video' then 'video/*'
        else null
      end as mime_type,

      null as file_size_bytes,
      null as width,
      null as height,

      case
        when p.media_type = 'image' then 'image'
        when p.media_type = 'gif' then 'gif'
        when p.media_type = 'video' then 'video'
        else null
      end as format,

      'Migrated legacy post media' as alt_text,

      p.sort_order,
      p.display_order,

      coalesce(post.created_at, now()) as created_at

    from prepared p
    join public.posts post
      on post.id = p.post_id
    join public.profiles pr
      on pr.id = p.user_id
    where p.provider <> 'invalid';
    "
)

Write-Step "Final posts/media validation"
Invoke-Native "Validate post/media counts" "psql" @(
    $TargetDbUrl,
    "-c",
    "
    select
      (select count(*) from public.migration_old_posts) as staged_posts,
      (select count(*) from public.posts) as v3_posts,
      (select count(*) from public.post_media where source = 'legacy_migration') as generated_legacy_media,
      (
        select count(*)
        from public.posts p
        left join public.profiles pr on pr.id = p.user_id
        where pr.id is null
      ) as posts_without_profiles,
      (
        select count(*)
        from public.post_media pm
        left join public.posts p on p.id = pm.post_id
        where p.id is null
      ) as media_without_posts;
    "
)

Write-Step "Visibility breakdown"
Invoke-Native "Visibility breakdown" "psql" @(
    $TargetDbUrl,
    "-c",
    "
    select visibility, count(*)
    from public.posts
    group by visibility
    order by visibility;
    "
)

Write-Step "Media breakdown"
Invoke-Native "Media breakdown" "psql" @(
    $TargetDbUrl,
    "-c",
    "
    select
      media_type,
      provider,
      count(*)
    from public.post_media
    where source = 'legacy_migration'
    group by media_type, provider
    order by media_type, provider;
    "
)

Write-Step "Checking skipped/invalid legacy media"
Invoke-Native "Skipped media check" "psql" @(
    $TargetDbUrl,
    "-c",
    "
    with media_source as (
      select id as post_id, 'image' as media_type, image_url as raw_url
      from public.migration_old_posts
      where nullif(trim(image_url), '') is not null

      union all

      select id as post_id, 'gif' as media_type, gif_url as raw_url
      from public.migration_old_posts
      where nullif(trim(gif_url), '') is not null

      union all

      select id as post_id, 'video' as media_type, video_url as raw_url
      from public.migration_old_posts
      where nullif(trim(video_url), '') is not null
    ),
    decoded as (
      select
        post_id,
        media_type,
        trim(raw_url) as raw_url,
        case
          when trim(raw_url) ~ '^\\x[0-9A-Fa-f]+$'
            then convert_from(decode(substr(trim(raw_url), 3), 'hex'), 'UTF8')
          else trim(raw_url)
        end as decoded_url
      from media_source
    ),
    normalized as (
      select
        post_id,
        media_type,
        case
          when decoded_url ilike 'http%' then decoded_url
          when decoded_url ilike 'q_auto,%/http%' then
            'https://res.cloudinary.com/triggerfeed/image/fetch/' || decoded_url
          else decoded_url
        end as url
      from decoded
    ),
    classified as (
      select
        post_id,
        media_type,
        url,
        case
          when media_type in ('image', 'video')
            and url ilike '%cloudinary.com/%'
            then 'cloudinary'
          when media_type = 'gif'
            and url ilike 'http%'
            then 'giphy'
          else 'invalid'
        end as provider
      from normalized
    )
    select
      count(*) as invalid_legacy_media
    from classified
    where provider = 'invalid';
    "
)

Write-Step "Sample migrated posts"
Invoke-Native "Sample migrated posts" "psql" @(
    $TargetDbUrl,
    "-c",
    "
    select
      p.id,
      pr.username,
      p.title,
      left(coalesce(p.body, ''), 60) as body_sample,
      p.visibility,
      p.is_sticky,
      p.removed_at is not null as migrated_flagged_removed,
      p.created_at
    from public.posts p
    join public.profiles pr on pr.id = p.user_id
    order by p.created_at desc
    limit 10;
    "
)

Write-Host ""
Write-Host "Local posts/media migration complete." -ForegroundColor Green
Write-Host "Now refresh the feed and verify old posts/images/videos render. Because the database claims it worked, which is adorable but not evidence." -ForegroundColor Green
