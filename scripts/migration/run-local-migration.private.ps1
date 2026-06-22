$ErrorActionPreference = "Stop"

Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

function Invoke-Step($Name, $ScriptBlock) {
  Write-Host ""
  Write-Host "==> $Name" -ForegroundColor Cyan

  & $ScriptBlock

  if ($LASTEXITCODE -ne 0) {
    throw "$Name failed with exit code $LASTEXITCODE"
  }
}

if (-not $env:OLD_TRIGGERFEED_DB_URL) {
  throw "OLD_TRIGGERFEED_DB_URL is not set. Set it in this terminal before running migration."
}

Invoke-Step "Reset local Supabase database" {
  npx supabase db reset
}

Invoke-Step "Import users and profiles" {
  .\scripts\migration\import-current-users-local.ps1
}

Invoke-Step "Import posts and media" {
  .\scripts\migration\import-current-posts-local.ps1
}

Invoke-Step "Import comments" {
  .\scripts\migration\import-current-comments-local.ps1
}

Invoke-Step "Import friends" {
  .\scripts\migration\import-current-friends-local.ps1
}

Invoke-Step "Import votes" {
  .\scripts\migration\import-current-votes-local.ps1
}

Write-Host ""
Write-Host "Full local migration completed." -ForegroundColor Green