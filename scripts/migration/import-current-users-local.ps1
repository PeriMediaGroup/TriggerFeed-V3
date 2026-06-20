# scripts/migration/import-current-users-local.ps1
# TriggerFeed V3 Local Auth/Profile Migration
#
# Imports current production users/profiles into LOCAL V3 Supabase.
#
# Requirements:
# - Local Supabase running
# - OLD_TRIGGERFEED_DB_URL set in this PowerShell session
# - pg_dump and psql available
#
# Usage:
#   $env:OLD_TRIGGERFEED_DB_URL="postgresql://postgres.usvcucujzfzazszcaonb:FnRmbP2LntmCME7u@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
#   .\scripts\migration\import-current-users-local.ps1 -ResetLocal

param(
  [switch]$ResetLocal,
  [string]$LocalDbUrl = "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  [string]$DumpDir = ".\migration-dumps"
)

$ErrorActionPreference = "Stop"

function Write-Step($message) {
  Write-Host ""
  Write-Host "==> $message" -ForegroundColor Cyan
}

function Require-Command($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Required command '$name' was not found. Install it or add it to PATH. Naturally, the machine demands tribute."
  }
}

Require-Command "psql"
Require-Command "pg_dump"
Require-Command "npx"

if (-not $env:OLD_TRIGGERFEED_DB_URL) {
  throw "OLD_TRIGGERFEED_DB_URL is not set. Set it first. Do not paste the password into Git, because civilization is fragile."
}

New-Item -ItemType Directory -Force $DumpDir | Out-Null

$AuthDump = Join-Path $DumpDir "old-auth-data.sql"
$ProfilesCsv = Join-Path $DumpDir "old-profiles.csv"

Write-Step "Using local DB URL"
Write-Host $LocalDbUrl

Write-Step "Testing old production DB connection"
psql $env:OLD_TRIGGERFEED_DB_URL -c "select count(*) as old_auth_users from auth.users;"

Write-Step "Testing local V3 DB connection"
psql $LocalDbUrl -c "select current_database(), current_user;"

if ($ResetLocal) {
  Write-Step "Resetting local Supabase database"
  npx supabase db reset
} else {
  Write-Host ""
  Write-Host "Skipping local reset. Use -ResetLocal if you want a clean rebuild." -ForegroundColor Yellow
}

Write-Step "Checking local counts before import"
psql $LocalDbUrl -c "
select
  (select count(*) from auth.users) as auth_users,
  (select count(*) from public.profiles) as profiles;
"

Write-Step "Exporting old production auth schema data"
pg_dump $env:OLD_TRIGGERFEED_DB_URL `
  --schema=auth `
  --data-only `
  --column-inserts `
  --no-owner `
  --no-privileges `
  --file=$AuthDump

Write-Step "Exporting old production profiles as UTF-8 CSV"
$env:PGCLIENTENCODING = "UTF8"

if (Test-Path $ProfilesCsv) {
  Remove-Item $ProfilesCsv -Force
}

psql $env:OLD_TRIGGERFEED_DB_URL -c "\copy (
  select *
  from public.profiles
  order by created_at
) to '$($ProfilesCsv.Replace('\','/'))' with csv header"

Write-Step "Importing old auth data into local V3"
psql $LocalDbUrl -f $AuthDump

Write-Step "Creating old profile staging table"
psql $LocalDbUrl -c "
drop table if exists public.migration_old_profiles;

create table public.migration_old_profiles (
  id uuid,
  username text,
  email text,
  first_name text,
  last_name text,
  city text,
  state text,
  dob date,
  joined_at timestamp without time zone,
  about text,
  profile_image_url text,
  role text,
  rank text,
  privacy_settings jsonb,
  created_at timestamp with time zone,
  badges jsonb,
  is_muted boolean,
  is_banned boolean,
  banner_url text,
  top_friends text[],
  top_guns text[],
  is_deleted boolean,
  is_paused boolean,
  ban_reason text,
  ban_expires timestamp with time zone,
  notes text
);
"

Write-Step "Loading old profiles into staging table"
psql $LocalDbUrl -c "\copy public.migration_old_profiles from '$($ProfilesCsv.Replace('\','/'))' with csv header"

Write-Step "Checking staging profile count"
psql $LocalDbUrl -c "
select count(*) as old_profile_staging_count
from public.migration_old_profiles;
"

Write-Step "Transforming old profiles into V3 profiles"
psql $LocalDbUrl -c "
with cleaned as (
  select
    old.*,
    u.email as auth_email,

    coalesce(
      nullif(
        regexp_replace(
          regexp_replace(trim(old.username), '[^A-Za-z0-9_]', '_', 'g'),
          '_+',
          '_',
          'g'
        ),
        ''
      ),
      'user_' || left(old.id::text, 8)
    ) as base_username

  from public.migration_old_profiles old
  join auth.users u
    on u.id = old.id
),
deduped as (
  select
    cleaned.*,
    case
      when count(*) over (partition by lower(base_username)) > 1
        then base_username || '_' || left(id::text, 8)
      else base_username
    end as final_username
  from cleaned
)
insert into public.profiles (
  id,
  email,
  username,
  username_lower,
  display_name,
  first_name,
  last_name,
  city,
  state,
  bio,
  dob,
  age_verified_at,
  age_gate_version,
  birthday_messages_enabled,
  avatar_cloudinary_url,
  avatar_cloudinary_public_id,
  banner_cloudinary_url,
  banner_cloudinary_public_id,
  role,
  profile_badge,
  is_banned,
  is_muted,
  is_deleted,
  privacy_settings,
  created_at,
  updated_at,
  last_seen_rank_key,
  last_seen_rank_at
)
select
  id,

  coalesce(nullif(trim(email), ''), auth_email) as email,

  final_username as username,
  lower(final_username) as username_lower,

  coalesce(
    nullif(trim(username), ''),
    nullif(trim(concat_ws(' ', first_name, last_name)), ''),
    split_part(coalesce(nullif(trim(email), ''), auth_email), '@', 1),
    final_username
  ) as display_name,

  nullif(trim(first_name), '') as first_name,
  nullif(trim(last_name), '') as last_name,
  nullif(trim(city), '') as city,
  nullif(trim(state), '') as state,
  nullif(trim(about), '') as bio,

  dob,

  case
    when dob is not null
      and dob <= (current_date - interval '18 years')
      then coalesce(created_at, joined_at::timestamptz, now())
    else null
  end as age_verified_at,

  'v1' as age_gate_version,
  true as birthday_messages_enabled,

  nullif(trim(profile_image_url), '') as avatar_cloudinary_url,
  null as avatar_cloudinary_public_id,

  nullif(trim(banner_url), '') as banner_cloudinary_url,
  null as banner_cloudinary_public_id,

  case
    when lower(trim(role)) in ('ceo', 'admin', 'moderator', 'user')
      then lower(trim(role))
    when lower(final_username) in ('tf_one', 'tf-one')
      then 'ceo'
    else 'user'
  end as role,

  null as profile_badge,

  coalesce(is_banned, false) as is_banned,
  coalesce(is_muted, false) as is_muted,
  coalesce(is_deleted, false) as is_deleted,

  coalesce(
    privacy_settings,
    jsonb_build_object(
      'show_email', false,
      'show_real_name', false,
      'show_location', false
    )
  ) as privacy_settings,

  coalesce(created_at, joined_at::timestamptz, now()) as created_at,
  now() as updated_at,

  null as last_seen_rank_key,
  null as last_seen_rank_at

from deduped
on conflict (id) do update set
  created_at = excluded.created_at,
  email = excluded.email,
  username = excluded.username,
  username_lower = excluded.username_lower,
  display_name = excluded.display_name,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  city = excluded.city,
  state = excluded.state,
  bio = excluded.bio,
  dob = excluded.dob,
  age_verified_at = excluded.age_verified_at,
  age_gate_version = excluded.age_gate_version,
  birthday_messages_enabled = excluded.birthday_messages_enabled,
  avatar_cloudinary_url = excluded.avatar_cloudinary_url,
  avatar_cloudinary_public_id = excluded.avatar_cloudinary_public_id,
  banner_cloudinary_url = excluded.banner_cloudinary_url,
  banner_cloudinary_public_id = excluded.banner_cloudinary_public_id,
  role = excluded.role,
  profile_badge = excluded.profile_badge,
  is_banned = excluded.is_banned,
  is_muted = excluded.is_muted,
  is_deleted = excluded.is_deleted,
  privacy_settings = excluded.privacy_settings,
  updated_at = now();
"

Write-Step "Final auth/profile validation"
psql $LocalDbUrl -c "
select
  (select count(*) from auth.users) as auth_user_count,
  (select count(*) from public.profiles) as profile_count,
  (
    select count(*)
    from auth.users u
    left join public.profiles p on p.id = u.id
    where p.id is null
  ) as auth_without_profile_count,
  (
    select count(*)
    from public.profiles p
    left join auth.users u on u.id = p.id
    where u.id is null
  ) as profile_without_auth_count;
"

Write-Step "Checking bad usernames"
psql $LocalDbUrl -c "
select id, username
from public.profiles
where username is null
   or trim(username) = ''
   or username <> trim(username)
   or username like '% %'
   or username !~ '^[A-Za-z0-9_]+$';
"

Write-Step "Checking duplicate usernames"
psql $LocalDbUrl -c "
select username_lower, count(*)
from public.profiles
group by username_lower
having count(*) > 1;
"

Write-Step "Checking roles"
psql $LocalDbUrl -c "
select role, count(*)
from public.profiles
group by role
order by role;
"

Write-Step "Checking DOB / age gate status"
psql $LocalDbUrl -c "
select
  count(*) filter (where dob is null) as missing_dob,
  count(*) filter (where dob is not null and age_verified_at is not null) as age_verified,
  count(*) filter (where dob is not null and age_verified_at is null) as dob_present_not_verified
from public.profiles;
"

Write-Step "Sample migrated users"
psql $LocalDbUrl -c "
select
  username,
  role,
  is_banned,
  is_muted,
  is_deleted,
  created_at
from public.profiles
order by created_at
limit 10;
"

Write-Host ""
Write-Host "Local auth/profile migration complete." -ForegroundColor Green
Write-Host "Now test login with TF-One, Riot, Keri, and one normal user. Because apparently software needs supervision." -ForegroundColor Green