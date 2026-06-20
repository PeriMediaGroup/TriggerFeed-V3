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
  throw "OLD_TRIGGERFEED_DB_URL still looks like a placeholder. Humanity remains on probation."
}

New-Item -ItemType Directory -Force -Path $DumpDir | Out-Null

$oldFriendsCsv = Join-Path $DumpDir "old-friends.csv"

Write-Step "Export old friends"
$env:PGCLIENTENCODING = "UTF8"

Invoke-Native "Export old friends CSV" "psql" @(
  $env:OLD_TRIGGERFEED_DB_URL,
  "-c",
  "\copy (
    select
      user_id,
      friend_id,
      status,
      created_at
    from public.friends
    order by created_at, user_id, friend_id
  ) to '$oldFriendsCsv' with csv header"
)

if (-not (Test-Path $oldFriendsCsv)) {
  throw "Expected friends export was not created: $oldFriendsCsv"
}

$friendLineCount = (Get-Content $oldFriendsCsv | Measure-Object -Line).Lines

if ($friendLineCount -le 1) {
  throw "Friends export is empty. No friends. Bleak, but not migratable."
}

Write-Host "Exported friends CSV lines: $friendLineCount"

Invoke-Native "Create friends staging table" "psql" @(
  $LocalDbUrl,
  "-c",
  "
  drop table if exists public.migration_old_friends;

  create table public.migration_old_friends (
    user_id uuid not null,
    friend_id uuid not null,
    status text,
    created_at timestamp without time zone
  );
  "
)

Invoke-Native "Import friends into staging" "psql" @(
  $LocalDbUrl,
  "-c",
  "\copy public.migration_old_friends (
    user_id,
    friend_id,
    status,
    created_at
  ) from '$oldFriendsCsv' with csv header"
)

Invoke-Native "Validate staged friends" "psql" @(
  $LocalDbUrl,
  "-c",
  "
  select status, count(*) as staged_rows
  from public.migration_old_friends
  group by status
  order by status;

  select count(*) as staged_friend_rows
  from public.migration_old_friends;

  select count(*) as self_friend_rows
  from public.migration_old_friends
  where user_id = friend_id;

  select count(*) as friends_without_local_user_profile
  from public.migration_old_friends f
  left join public.profiles p on p.id = f.user_id
  where p.id is null;

  select count(*) as friends_without_local_friend_profile
  from public.migration_old_friends f
  left join public.profiles p on p.id = f.friend_id
  where p.id is null;

  select count(*) as mirrored_accepted_pairs
  from (
    select
      least(user_id, friend_id) as low_id,
      greatest(user_id, friend_id) as high_id
    from public.migration_old_friends
    where lower(coalesce(status, '')) = 'accepted'
      and user_id <> friend_id
    group by least(user_id, friend_id), greatest(user_id, friend_id)
    having count(*) > 1
  ) pairs;

  select count(*) as unique_accepted_pairs
  from (
    select
      least(user_id, friend_id) as low_id,
      greatest(user_id, friend_id) as high_id
    from public.migration_old_friends
    where lower(coalesce(status, '')) = 'accepted'
      and user_id <> friend_id
    group by least(user_id, friend_id), greatest(user_id, friend_id)
  ) pairs;

  select count(*) as unique_pending_rows
  from (
    select distinct user_id, friend_id
    from public.migration_old_friends
    where lower(coalesce(status, '')) = 'pending'
      and user_id <> friend_id
  ) pending;
  "
)

Invoke-Native "Delete existing migrated friend rows" "psql" @(
  $LocalDbUrl,
  "-c",
  "
  delete from public.friends f
  using (
    select distinct
      least(user_id, friend_id) as low_id,
      greatest(user_id, friend_id) as high_id
    from public.migration_old_friends
    where user_id <> friend_id
  ) old_pairs
  where least(f.requester_id, f.addressee_id) = old_pairs.low_id
    and greatest(f.requester_id, f.addressee_id) = old_pairs.high_id;
  "
)

Invoke-Native "Insert migrated friends" "psql" @(
  $LocalDbUrl,
  "-c",
  "
  with accepted_pairs as (
    select
      least(user_id, friend_id) as requester_id,
      greatest(user_id, friend_id) as addressee_id,
      'accepted'::text as status,
      min(coalesce(created_at, now()))::timestamptz as created_at,
      max(coalesce(created_at, now()))::timestamptz as updated_at
    from public.migration_old_friends
    where lower(coalesce(status, '')) = 'accepted'
      and user_id <> friend_id
    group by least(user_id, friend_id), greatest(user_id, friend_id)
  ),
  pending_rows as (
    select distinct on (user_id, friend_id)
      user_id as requester_id,
      friend_id as addressee_id,
      'pending'::text as status,
      coalesce(created_at, now())::timestamptz as created_at,
      coalesce(created_at, now())::timestamptz as updated_at
    from public.migration_old_friends pending
    where lower(coalesce(status, '')) = 'pending'
      and user_id <> friend_id
      and not exists (
        select 1
        from accepted_pairs accepted
        where accepted.requester_id = least(pending.user_id, pending.friend_id)
          and accepted.addressee_id = greatest(pending.user_id, pending.friend_id)
      )
    order by user_id, friend_id, created_at desc nulls last
  ),
  final_rows as (
    select * from accepted_pairs
    union all
    select * from pending_rows
  )
  insert into public.friends (
    id,
    requester_id,
    addressee_id,
    status,
    created_at,
    updated_at
  )
  select
    gen_random_uuid() as id,
    final.requester_id,
    final.addressee_id,
    final.status,
    final.created_at,
    final.updated_at
  from final_rows final
  join public.profiles requester
    on requester.id = final.requester_id
  join public.profiles addressee
    on addressee.id = final.addressee_id
  on conflict do nothing;
  "
)

Invoke-Native "Validate migrated friends" "psql" @(
  $LocalDbUrl,
  "-c",
  "
  select status, count(*) as migrated_rows
  from public.friends
  group by status
  order by status;

  select count(*) as migrated_friend_rows
  from public.friends;

  select count(*) as self_friend_rows
  from public.friends
  where requester_id = addressee_id;

  select count(*) as duplicate_unordered_friend_pairs
  from (
    select
      least(requester_id, addressee_id) as low_id,
      greatest(requester_id, addressee_id) as high_id,
      count(*) as row_count
    from public.friends
    group by least(requester_id, addressee_id), greatest(requester_id, addressee_id)
    having count(*) > 1
  ) duplicates;

  select
    f.status,
    requester.username as requester_username,
    addressee.username as addressee_username,
    f.created_at
  from public.friends f
  left join public.profiles requester on requester.id = f.requester_id
  left join public.profiles addressee on addressee.id = f.addressee_id
  order by f.created_at desc
  limit 20;
  "
)

Write-Host ""
Write-Host "Friend migration complete." -ForegroundColor Green