# Apply BrokerSnapshot monitoring tables to the linked Supabase project.
# First time: npx supabase@latest login && npx supabase@latest link --project-ref YOUR_REF

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "Applying migration 034 to linked project..." -ForegroundColor Cyan
npx supabase@latest db query --linked -f supabase/migrations/034_brokersnapshot_monitoring.sql

Write-Host "Verifying tables..." -ForegroundColor Cyan
npx supabase@latest db query --linked "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'brokersnapshot%' ORDER BY table_name;"

Write-Host "Done. Wait ~30 seconds for schema cache, then try Run sync now." -ForegroundColor Green
