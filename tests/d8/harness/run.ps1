# D8 harness orchestrator — runs the full concurrency gate.
# Requires Docker Desktop. Uses an isolated throwaway postgres:15.
$ErrorActionPreference = "Stop"
$harness = $PSScriptRoot
$migration = "C:\SMG\04_PRODUTOS\SMG_BARBER\sou-manager\supabase\migrations\20260827120000_d8_worker_rpc_surface.sql"
$env:D8_CONTAINER = "d8harness-pg"

Write-Host "==> [1/4] Start + migrate"
& "$harness\setup.ps1"
if ($LASTEXITCODE -ne 0) { throw "setup failed" }

# stub roles the migration needs (supabase normally provides them)
docker exec $env:D8_CONTAINER psql -U postgres -d d8test -c "DO `$`$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF; IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF; END `$`$;" | Out-Null

Write-Host "==> [2/4] Seed"
docker cp "$harness\01_seed.sql" $env:D8_CONTAINER:/tmp/01_seed.sql
docker exec $env:D8_CONTAINER psql -U postgres -d d8test -v ON_ERROR_STOP=1 -f /tmp/01_seed.sql | Out-Null

Write-Host "==> [3/4] Concurrency 2x"
& "$harness\concurrency2.ps1"
Write-Host "==> [4/4] Concurrency 20x"
& "$harness\concurrency20.ps1"

Write-Host "GATE COMPLETE"
