$script:LocalTargetPattern = '(?i)(localhost|127\.0\.0\.1|\[::1\])'

function Write-MigrationStep {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Message
  )

  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Step {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Message
  )

  Write-MigrationStep $Message
}

function Require-MigrationCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' was not found. Install it or add it to PATH."
  }
}

function Require-Command {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  Require-MigrationCommand $Name
}

function Require-MigrationEnvVar {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  $value = [Environment]::GetEnvironmentVariable($Name)
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "$Name is not set. Set it in this PowerShell session before running this script."
  }

  if ($value -match '(?i)(YOUR_|YOUR-|<[^>]+>|PASSWORD|HOST)') {
    throw "$Name appears to contain placeholder text. Replace it with the intended value before running this script."
  }

  return $value
}

function Assert-RemoteTargetDbUrl {
  param(
    [Parameter(Mandatory = $true)]
    [string]$TargetDbUrl
  )

  if ([string]::IsNullOrWhiteSpace($TargetDbUrl)) {
    throw "TRIGGERFEED_V3_DB_URL is not set. Set it to the V3 target database URL before running this script."
  }

  if ($TargetDbUrl -match '(?i)(YOUR_|YOUR-|<[^>]+>|PASSWORD|HOST)') {
    throw "TRIGGERFEED_V3_DB_URL appears to contain placeholder text. Replace it with the intended target before running this script."
  }

  if ($TargetDbUrl -match $script:LocalTargetPattern) {
    throw "TRIGGERFEED_V3_DB_URL points to a local database. Remote import scripts require a non-local V3 target."
  }
}

function Get-RedactedDbLabel {
  param(
    [Parameter(Mandatory = $true)]
    [string]$DbUrl
  )

  try {
    $uri = [Uri]$DbUrl
    $database = $uri.AbsolutePath.TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($database)) {
      $database = "(database not specified)"
    }

    return "$($uri.Scheme)://$($uri.Host):$($uri.Port)/$database"
  } catch {
    return "(unparseable database URL; value redacted)"
  }
}

function Confirm-ProductionImport {
  param(
    [Parameter(Mandatory = $true)]
    [bool]$Confirmed,
    [Parameter(Mandatory = $true)]
    [bool]$DryRun
  )

  if ($DryRun) {
    Write-Host "Dry run validation passed. No database connections or imports were attempted." -ForegroundColor Yellow
    return
  }

  if (-not $Confirmed) {
    throw "Refusing to run. Re-run with -ConfirmProductionImport after reviewing the target and import order."
  }
}

function Invoke-MigrationNative {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Description,
    [Parameter(Mandatory = $true)]
    [string]$Command,
    [Parameter(Mandatory = $true)]
    [object[]]$Arguments
  )

  Write-MigrationStep $Description
  & $Command @Arguments

  if ($LASTEXITCODE -ne 0) {
    throw "$Description failed with exit code $LASTEXITCODE"
  }
}

function Invoke-Native {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Description,
    [Parameter(Mandatory = $true)]
    [string]$Command,
    [Parameter(Mandatory = $true)]
    [object[]]$Arguments
  )

  Invoke-MigrationNative -Description $Description -Command $Command -Arguments $Arguments
}
