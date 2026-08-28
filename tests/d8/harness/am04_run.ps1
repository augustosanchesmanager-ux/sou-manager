# D8 Amendment-04 gate orchestrator: setup (Gate A + Amd-04) then behavior tests.
$ErrorActionPreference = "Stop"
$harness = $PSScriptRoot

Write-Host "==> [1/2] Setup (stub + Gate A + Amd-04)"
& "$harness\am04_setup.ps1"
if ($LASTEXITCODE -ne 0) { throw "setup failed" }

Write-Host "==> [2/2] Tests"
cmd /c "docker cp `"$harness\am04_test.sql`" d8harness4-pg:/tmp/am04_test.sql" 2>&1 | Out-Null
$ErrorActionPreference = 'Continue'
$evidence = "$env:TEMP\opencode\am04_evidence.txt"
# Capture psql stdout (SQL PASS notices) into the evidence file; psql NOTICE
# goes to stderr and would otherwise be swallowed as a PS 5.1 NativeCommandError.
cmd /c "docker exec d8harness4-pg psql -U postgres -d d8test -v ON_ERROR_STOP=1 -f /tmp/am04_test.sql 2>&1" 1> $evidence
$code = $LASTEXITCODE
Get-Content $evidence | Select-String -Pattern "PASS|FAIL|GRANT_SUMMARY|^[a-z_]+$|^" | ForEach-Object { $_.Line }
if ($code -ne 0) { $ErrorActionPreference = 'Stop'; throw "test batch failed (exit $code)" }
$ErrorActionPreference = 'Stop'

Write-Host "==> Cleanup"
$ErrorActionPreference = 'Continue'
cmd /c "docker rm -f d8harness4-pg" 2>&1 | Out-Null
$ErrorActionPreference = 'Stop'
Write-Host "GATE COMPLETE"
