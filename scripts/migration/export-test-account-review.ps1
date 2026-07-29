param(
  [string]$TargetDbUrl = $env:TRIGGERFEED_V3_DB_URL,
  [string]$OutputDir = ".\migration-review"
)

$ErrorActionPreference = "Stop"

$HelperPath = Join-Path $PSScriptRoot "lib\MigrationSafety.psm1"
Import-Module $HelperPath -Force -DisableNameChecking

Require-MigrationCommand "psql"

if ([string]::IsNullOrWhiteSpace($TargetDbUrl)) {
  throw "Target database URL is required. Set TRIGGERFEED_V3_DB_URL or pass -TargetDbUrl."
}

$SqlPath = Join-Path $PSScriptRoot "review-test-accounts.sql"
if (-not (Test-Path $SqlPath)) {
  throw "Missing SQL file: $SqlPath"
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$OutputPath = Join-Path $OutputDir "test-account-candidates-$timestamp.csv"

Write-MigrationStep "Exporting test-account candidate review"
Write-Host "Target: $(Get-RedactedDbLabel $TargetDbUrl)"
Write-Host "Output: $OutputPath"

& psql $TargetDbUrl -v ON_ERROR_STOP=1 -f $SqlPath --csv -o $OutputPath
if ($LASTEXITCODE -ne 0) {
  throw "Test-account candidate export failed with exit code $LASTEXITCODE"
}

Write-Host "Candidate review CSV written: $OutputPath" -ForegroundColor Green
