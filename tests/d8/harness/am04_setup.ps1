# D8 Amendment-04 harness: starts postgres, applies stub + Gate A + Amendment-04.
# Keeps $ErrorActionPreference='Stop' for the CRITICAL psql migration steps
# (so a real SQL failure aborts — gate criterion #1) while tolerating benign
# stderr from docker container cleanup/startup under PS 5.1.
$repo = "C:\SMG\04_PRODUTOS\SMG_BARBER\sou-manager"
$stub = "$repo\tests\d8\harness\00_stub_schema.sql"
$gateA = "$repo\supabase\migrations\20260827120000_d8_worker_rpc_surface.sql"
$am04 = "$repo\supabase\migrations\20260828000000_d8_worker_retry_dead_letter.sql"

# ---- benign docker teardown/startup (tolerate stderr) ----
$ErrorActionPreference = 'Continue'
cmd /c "docker rm -f d8harness4-pg" 2>&1 | Out-Null
cmd /c "docker run -d --name d8harness4-pg -e POSTGRES_PASSWORD=secret -e POSTGRES_DB=d8test -p 55433:5432 postgres:15" 2>&1 | Out-Null
$ErrorActionPreference = 'Stop'

Write-Host "==> Waiting for postgres ready..."
$wait = 0
while ($wait -lt 60) {
  $ready = cmd /c "docker exec d8harness4-pg pg_isready -U postgres" 2>&1
  if ($ready -match "accepting connections") { break }
  Start-Sleep -Seconds 1; $wait++
}

Write-Host "==> Copy SQL into container..."
cmd /c "docker cp `"$stub`" d8harness4-pg:/tmp/00_stub_schema.sql" 2>&1 | Out-Null
cmd /c "docker cp `"$gateA`" d8harness4-pg:/tmp/gateA.sql" 2>&1 | Out-Null
cmd /c "docker cp `"$am04`" d8harness4-pg:/tmp/am04.sql" 2>&1 | Out-Null

Write-Host "==> Apply stub schema..."
$ErrorActionPreference = 'Continue'
docker exec d8harness4-pg psql -U postgres -d d8test -v ON_ERROR_STOP=1 -f /tmp/00_stub_schema.sql 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw "stub failed" }

Write-Host "==> Ensure auth roles (supabase normally provides them)..."
docker exec d8harness4-pg psql -U postgres -d d8test -c "DO `$`$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF; IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF; END `$`$;" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw "role bootstrap failed" }

Write-Host "==> Apply Gate A migration..."
docker exec d8harness4-pg psql -U postgres -d d8test -v ON_ERROR_STOP=1 -f /tmp/gateA.sql 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw "gateA migration failed" }

Write-Host "==> Apply Amendment-04 migration..."
docker exec d8harness4-pg psql -U postgres -d d8test -v ON_ERROR_STOP=1 -f /tmp/am04.sql 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw "am04 migration failed" }
$ErrorActionPreference = 'Stop'

Write-Host "SETUP OK (Gate A + Amd-04 applied)"
