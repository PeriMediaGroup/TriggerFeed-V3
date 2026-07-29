param(
  [string]$TargetDbUrl = $env:TRIGGERFEED_V3_DB_URL,
  [string]$OutputDir = ".\migration-review",
  [string]$ExpectedCountsPath,
  [switch]$LocalRehearsal
)

$ErrorActionPreference = "Stop"

$HelperPath = Join-Path $PSScriptRoot "lib\MigrationSafety.psm1"
Import-Module $HelperPath -Force -DisableNameChecking

Require-MigrationCommand "psql"

if ([string]::IsNullOrWhiteSpace($TargetDbUrl)) {
  throw "Target database URL is required. Set TRIGGERFEED_V3_DB_URL or pass -TargetDbUrl."
}

if (-not $LocalRehearsal -and $TargetDbUrl -match '(?i)(localhost|127\.0\.0\.1|\[::1\])') {
  throw "Target database URL points to localhost. Use -LocalRehearsal only for disposable local verification."
}

$SqlPath = Join-Path $PSScriptRoot "production-verify.sql"
if (-not (Test-Path $SqlPath)) {
  throw "Missing SQL file: $SqlPath"
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$ReportPath = Join-Path $OutputDir "production-verification-$timestamp.csv"

Write-MigrationStep "Running production import verification"
Write-Host "Mode: $(if ($LocalRehearsal) { 'local rehearsal' } else { 'production verification' })"
Write-Host "Target: $(Get-RedactedDbLabel $TargetDbUrl)"
Write-Host "Report: $ReportPath"

& psql $TargetDbUrl -v ON_ERROR_STOP=1 -f $SqlPath --csv -o $ReportPath
if ($LASTEXITCODE -ne 0) {
  throw "Production verification SQL failed with exit code $LASTEXITCODE"
}

$Rows = @(Import-Csv -LiteralPath $ReportPath)

if ($ExpectedCountsPath) {
  if (-not (Test-Path $ExpectedCountsPath)) {
    throw "Expected count file was not found: $ExpectedCountsPath"
  }

  $Expected = Get-Content -LiteralPath $ExpectedCountsPath -Raw | ConvertFrom-Json
  $CheckMap = @{
    auth_users = "auth_user_count"
    profiles = "profile_count"
    posts = "post_count"
    post_media = "post_media_count"
    comments = "comment_count"
    friends = "friend_count"
    votes = "post_vote_count"
  }

  $CountRows = @{}
  foreach ($Name in @("post_count", "post_media_count", "comment_count", "friend_count", "post_vote_count")) {
    $Sql = switch ($Name) {
      "post_count" { "select count(*) from public.posts;" }
      "post_media_count" { "select count(*) from public.post_media;" }
      "comment_count" { "select count(*) from public.comments;" }
      "friend_count" { "select count(*) from public.friends;" }
      "post_vote_count" { "select count(*) from public.post_votes;" }
    }
    $Value = (& psql $TargetDbUrl -v ON_ERROR_STOP=1 -t -A -c $Sql).Trim()
    if ($LASTEXITCODE -ne 0) {
      throw "Expected-count query failed for $Name"
    }
    $CountRows[$Name] = $Value
  }

  foreach ($Property in $Expected.PSObject.Properties) {
    if (-not $CheckMap.ContainsKey($Property.Name)) {
      continue
    }

    $ExpectedSpec = $Property.Value
    $ExpectedImportedCount = $ExpectedSpec.expected_imported_count
    if ($null -eq $ExpectedImportedCount -or "$ExpectedImportedCount" -eq "") {
      continue
    }

    $CheckName = $CheckMap[$Property.Name]
    $ExistingRow = $Rows | Where-Object { $_.check_name -eq $CheckName } | Select-Object -First 1
    $Actual = if ($ExistingRow) { $ExistingRow.actual_value } else { $CountRows[$CheckName] }
    $AcceptedVariance = if ($null -ne $ExpectedSpec.accepted_variance) { [int]$ExpectedSpec.accepted_variance } else { 0 }
    $Delta = [math]::Abs(([int64]$Actual) - ([int64]$ExpectedImportedCount))
    $Status = if ($Delta -le $AcceptedVariance) { "PASS" } else { "FAIL" }

    $Rows += [pscustomobject]@{
      check_name = "expected_count_$($Property.Name)"
      actual_value = "$Actual"
      expected_condition = "expected imported count $ExpectedImportedCount with accepted variance $AcceptedVariance"
      status = $Status
      detail = "Expected count reconciliation from $ExpectedCountsPath"
    }
  }

  $Rows | Export-Csv -LiteralPath $ReportPath -NoTypeInformation
}

$FailCount = @($Rows | Where-Object { $_.status -eq "FAIL" }).Count
$WarnCount = @($Rows | Where-Object { $_.status -eq "WARN" }).Count

Write-Host "Verification report written: $ReportPath"
Write-Host "FAIL: $FailCount"
Write-Host "WARN: $WarnCount"

if ($FailCount -gt 0) {
  exit 1
}

exit 0
