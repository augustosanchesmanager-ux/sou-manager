# D8 harness: starts postgres, applies stub + migration, validates.
$ErrorActionPreference = "Stop"
$harness = "C:\Users\admsm\AppData\Local\Temp\opencode\d8harness"
$migration = "C:\SMG\04_PRODUTOS\SMG_BARBER\sou-manager\supabase\migrations\20260827120000_d8_worker_rpc_surface.sql"

Write-Host "==> Starting postgres:15 container..."
docker rm -f d8harness-pg 2>$null | Out-Null
docker run -d --name d8harness-pg -e POSTGRES_PASSWORD=secret -e POSTGRES_DB=d8test -p 55432:5432 postgres:15

Write-Host "==> Waiting for postgres to be ready..."
$wait = 0
while ($wait -lt 60) {
  $ok = docker exec d8harness-pg pg_isready -U postgres 2>$null
  if ($ok -match "accepting connections") { break }
  Start-Sleep -Seconds 1
  $wait++
}

Write-Host "==> Applying stub schema..."
docker cp "$harness\00_stub_schema.sql" d8harness-pg:/tmp/00_stub_schema.sql
docker exec d8harness-pg psql -U postgres -d d8test -v ON_ERROR_STOP=1 -f /tmp/00_stub_schema.sql

Write-Host "==> Applying D8 migration..."
docker cp $migration d8harness-pg:/tmp/d8_migration.sql
docker exec d8harness-pg psql -U postgres -d d8test -v ON_ERROR_STOP=1 -f /tmp/d8_migration.sql

Write-Host "DONE setup OK"
