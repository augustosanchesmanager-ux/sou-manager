# F1 harness: starts postgres, applies stub + F1 migration.
$ErrorActionPreference = "Stop"
$harness = $PSScriptRoot
$migration = "C:\SMG\04_PRODUTOS\SMG_BARBER\sou-manager\supabase\migrations\20260914130000_f1_staff_role_hierarchy_enforcement.sql"

Write-Host "==> Starting postgres:15 container (port 55433)..."
$existing = docker ps -a --filter "name=f1harness-pg" --format "{{.ID}}"
if ($existing) {
  docker rm -f f1harness-pg | Out-Null
}
docker run -d --name f1harness-pg -e POSTGRES_PASSWORD=secret -e POSTGRES_DB=f1test -p 55433:5432 postgres:15

Write-Host "==> Waiting for postgres to be ready..."
$wait = 0
while ($wait -lt 60) {
  $ok = docker exec f1harness-pg pg_isready -U postgres 2>$null
  if ($ok -match "accepting connections") { break }
  Start-Sleep -Seconds 1
  $wait++
}

Write-Host "==> Applying stub schema..."
docker cp "$harness\00_stub_schema.sql" f1harness-pg:/tmp/00_stub_schema.sql
docker exec f1harness-pg psql -U postgres -d f1test -v ON_ERROR_STOP=1 -f /tmp/00_stub_schema.sql

Write-Host "==> Applying F1 migration..."
docker cp $migration f1harness-pg:/tmp/f1_migration.sql
docker exec f1harness-pg psql -U postgres -d f1test -v ON_ERROR_STOP=1 -f /tmp/f1_migration.sql

Write-Host "DONE setup OK"