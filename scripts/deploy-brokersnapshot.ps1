# Deploy brokersnapshot-sync edge function and verify API token secret.
# Run from repo root in PowerShell.
#
# First time only:
#   npx supabase@latest login
#   npx supabase@latest link --project-ref YOUR_PROJECT_REF
#
# Set API token (required — Dashboard "Custom secrets" may NOT reach edge functions):
#   npx supabase@latest secrets set BROKERSNAPSHOT_API_TOKEN=your_token_here --project-ref YOUR_PROJECT_REF
#
# Cron scope: only one team (owner UUID — e.g. Petar's auth.users id):
#   npx supabase@latest secrets set BROKERSNAPSHOT_CRON_OWNER_ID=owner-uuid-here --project-ref YOUR_PROJECT_REF

param(
  [string]$ProjectRef = "xntxsecsdzqhpfcohylh"
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "Checking edge function secrets on project $ProjectRef..." -ForegroundColor Cyan
$secretList = npx supabase@latest secrets list --project-ref $ProjectRef 2>&1 | Out-String
if ($secretList -notmatch "BROKERSNAPSHOT_API_TOKEN") {
  Write-Host ""
  Write-Host "WARNING: BROKERSNAPSHOT_API_TOKEN is NOT set for edge functions." -ForegroundColor Yellow
  Write-Host "Dashboard Custom secrets do not always apply to edge functions." -ForegroundColor Yellow
  Write-Host ""
  Write-Host "Run this command with your BrokerSnapshot token:" -ForegroundColor Yellow
  Write-Host "  npx supabase@latest secrets set BROKERSNAPSHOT_API_TOKEN=PASTE_TOKEN_HERE --project-ref $ProjectRef" -ForegroundColor White
  Write-Host ""
  $continue = Read-Host "Continue deploy anyway? (y/N)"
  if ($continue -ne "y" -and $continue -ne "Y") { exit 1 }
}

Write-Host "Deploying brokersnapshot-sync..." -ForegroundColor Cyan
npx supabase@latest functions deploy brokersnapshot-sync --no-verify-jwt --project-ref $ProjectRef

if ($LASTEXITCODE -eq 0) {
  Write-Host ""
  Write-Host "Deploy complete." -ForegroundColor Green
  Write-Host "Verify token: npx supabase@latest secrets list --project-ref $ProjectRef" -ForegroundColor Green
  Write-Host "Weekly cron: Mondays 06:00 UTC (migration 036). Verify in Dashboard -> Integrations -> Cron." -ForegroundColor Green
} else {
  exit 1
}
