param(
  [switch]$ConfirmProductionImport,
  [switch]$DryRun,
  [string]$DumpDir = "migration-dumps"
)

$ErrorActionPreference = "Stop"

$HelperPath = Join-Path $PSScriptRoot "lib\MigrationSafety.psm1"
Import-Module $HelperPath -Force -DisableNameChecking

Require-MigrationCommand "psql"

$SourceDbUrl = Require-MigrationEnvVar "OLD_TRIGGERFEED_DB_URL"
$TargetDbUrl = Require-MigrationEnvVar "TRIGGERFEED_V3_DB_URL"
Assert-RemoteTargetDbUrl -TargetDbUrl $TargetDbUrl

Write-MigrationStep "Validated remote votes import settings"
Write-Host "Source: $(Get-RedactedDbLabel $SourceDbUrl)"
Write-Host "Target: $(Get-RedactedDbLabel $TargetDbUrl)"

Confirm-ProductionImport -Confirmed:$ConfirmProductionImport.IsPresent -DryRun:$DryRun.IsPresent
if ($DryRun) {
  exit 0
}

New-Item -ItemType Directory -Force -Path $DumpDir | Out-Null

$oldVotesCsv = Join-Path $DumpDir "old-post-votes.csv"

Write-Step "Export old post votes"
$env:PGCLIENTENCODING = "UTF8"

Invoke-Native "Export old post votes CSV" "psql" @(
  $SourceDbUrl,
  "-c",
  "\copy (
    select
      id,
      user_id,
      post_id,
      value,
      created_at
    from public.post_votes
    where user_id is not null
      and post_id is not null
      and value in (-1, 1)
    order by created_at, id
  ) to '$oldVotesCsv' with csv header"
)

if (-not (Test-Path $oldVotesCsv)) {
  throw "Expected votes export was not created: $oldVotesCsv"
}

$voteLineCount = (Get-Content $oldVotesCsv | Measure-Object -Line).Lines

if ($voteLineCount -le 1) {
  throw "Votes export is empty. No votes to migrate. Democracy has failed quietly."
}

Write-Host "Exported vote CSV lines: $voteLineCount"

Invoke-Native "Create votes staging table" "psql" @(
  $TargetDbUrl,
  "-c",
  "
  drop table if exists public.migration_old_post_votes;

  create table public.migration_old_post_votes (
    id uuid primary key,
    user_id uuid,
    post_id uuid,
    value integer,
    created_at timestamp without time zone
  );
  "
)

Invoke-Native "Import votes into staging" "psql" @(
  $TargetDbUrl,
  "-c",
  "\copy public.migration_old_post_votes (
    id,
    user_id,
    post_id,
    value,
    created_at
  ) from '$oldVotesCsv' with csv header"
)

Invoke-Native "Validate staged votes" "psql" @(
  $TargetDbUrl,
  "-c",
  "
  select count(*) as staged_votes
  from public.migration_old_post_votes;

  select value, count(*) as staged_rows
  from public.migration_old_post_votes
  group by value
  order by value;

  select count(*) as votes_without_local_posts
  from public.migration_old_post_votes v
  left join public.posts p
    on p.id = v.post_id
  where p.id is null;

  select count(*) as votes_without_local_profiles
  from public.migration_old_post_votes v
  left join public.profiles p
    on p.id = v.user_id
  where p.id is null;

  select count(*) as duplicate_user_post_vote_pairs
  from (
    select user_id, post_id
    from public.migration_old_post_votes
    where user_id is not null
      and post_id is not null
    group by user_id, post_id
    having count(*) > 1
  ) duplicates;

  select count(*) as invalid_vote_values
  from public.migration_old_post_votes
  where value not in (-1, 1)
     or value is null;
  "
)

Invoke-Native "Delete existing migrated votes" "psql" @(
  $TargetDbUrl,
  "-c",
  "
  delete from public.post_votes pv
  using public.migration_old_post_votes old
  where pv.user_id = old.user_id
    and pv.post_id = old.post_id;
  "
)

Invoke-Native "Insert migrated votes" "psql" @(
  $TargetDbUrl,
  "-c",
  "
  insert into public.post_votes (
    id,
    post_id,
    user_id,
    vote_type,
    created_at,
    updated_at
  )
  select
    old.id,
    old.post_id,
    old.user_id,

    case
      when old.value = 1 then 'upvote'
      when old.value = -1 then 'downvote'
    end as vote_type,

    coalesce(old.created_at, now())::timestamptz as created_at,
    coalesce(old.created_at, now())::timestamptz as updated_at

  from public.migration_old_post_votes old
  join public.posts post
    on post.id = old.post_id
  join public.profiles voter
    on voter.id = old.user_id
  where old.value in (-1, 1)

  on conflict (user_id, post_id) do update
  set
    vote_type = excluded.vote_type,
    updated_at = excluded.updated_at;
  "
)

Invoke-Native "Validate migrated votes" "psql" @(
  $TargetDbUrl,
  "-c",
  "
  select vote_type, count(*) as migrated_rows
  from public.post_votes
  group by vote_type
  order by vote_type;

  select
    (select count(*) from public.migration_old_post_votes) as staged_votes,
    (
      select count(*)
      from public.post_votes pv
      join public.migration_old_post_votes old
        on old.user_id = pv.user_id
       and old.post_id = pv.post_id
    ) as migrated_votes;

  select count(*) as duplicate_user_post_vote_pairs
  from (
    select user_id, post_id
    from public.post_votes
    group by user_id, post_id
    having count(*) > 1
  ) duplicates;

  select count(*) as votes_without_posts
  from public.post_votes pv
  left join public.posts p
    on p.id = pv.post_id
  where p.id is null;

  select count(*) as votes_without_profiles
  from public.post_votes pv
  left join public.profiles p
    on p.id = pv.user_id
  where p.id is null;

  select
    pvc.post_id,
    post.title,
    pvc.upvote_count,
    pvc.downvote_count,
    pvc.score,
    pvc.vote_count
  from public.post_vote_counts pvc
  join public.posts post
    on post.id = pvc.post_id
  order by pvc.vote_count desc, pvc.score desc
  limit 20;
  "
)

Write-Host ""
Write-Host "Vote migration complete." -ForegroundColor Green
