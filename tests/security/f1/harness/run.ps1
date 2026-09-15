# F1 harness orchestrator — runs the full security gate.
# Requires Docker Desktop. Uses an isolated throwaway postgres:15.
$ErrorActionPreference = "Stop"
$harness = $PSScriptRoot

Write-Host "==> [1/2] Start + migrate"
& "$harness\setup.ps1"
if ($LASTEXITCODE -ne 0) { throw "setup failed" }

Write-Host "==> [2/2] Apply security gate (seed + vetores + fluxos)"
docker cp "$harness\01_f1_test.sql" f1harness-pg:/tmp/01_f1_test.sql
docker exec f1harness-pg psql -U postgres -d f1test -v ON_ERROR_STOP=1 -f /tmp/01_f1_test.sql
if ($LASTEXITCODE -ne 0) { throw "F1 GATE FAILED (exit $LASTEXITCODE)" }

Write-Host "F1 GATE PASSED"