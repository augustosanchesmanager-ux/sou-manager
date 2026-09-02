# D8 concurrency test — 2 INDEPENDENT sessions claim concurrently.
# Proves: Worker A != Worker B (no double-claim).
# Usage: run from tests/d8/harness (requires docker postgres from setup.ps1).
$ErrorActionPreference = "Continue"
$pg = if ($env:D8_CONTAINER) { $env:D8_CONTAINER } else { "d8harness-pg" }

Write-Host "==> Pre-condition: exactly 2 pending items"
docker exec $pg psql -U postgres -d d8test -c "DELETE FROM public.commission_records; UPDATE public.outbox_items SET status='pending', retry_attempts=0, retry_next_retry_at=NULL, retry_last_error=NULL, claimed_by=NULL, processing_started_at=NULL, completed_at=NULL, dispatched_at=NULL WHERE event_id IN ('evt_test_A_0001','evt_test_B_0002');" 2>$null | Out-Null
docker exec $pg psql -U postgres -d d8test -t -A -c "SELECT status FROM public.outbox_items;" 2>$null | ForEach-Object { Write-Host "   status: $_" }

# Launch 2 concurrent jobs (truly separate processes/connections)
$j1 = Start-Job -ScriptBlock {
  param($c, $wn)
  docker exec $c psql -U postgres -d d8test -t -A -c "SELECT public.claim_next_outbox_item(NULL::uuid, '$wn') AS c;" 2>$null
} -ArgumentList @($pg, 'worker-1')
$j2 = Start-Job -ScriptBlock {
  param($c, $wn)
  docker exec $c psql -U postgres -d d8test -t -A -c "SELECT public.claim_next_outbox_item(NULL::uuid, '$wn') AS c;" 2>$null
} -ArgumentList @($pg, 'worker-2')

Wait-Job -Job $j1, $j2 -Timeout 30 | Out-Null

$ev1 = Receive-Job -Job $j1
$ev2 = Receive-Job -Job $j2
Remove-Job -Job $j1, $j2 -Force

$ev1id = ($ev1 | Select-String -Pattern '"event_id": "([^"]+)"').Matches.Groups[1].Value
$ev2id = ($ev2 | Select-String -Pattern '"event_id": "([^"]+)"').Matches.Groups[1].Value
$cl1   = ($ev1 | Select-String -Pattern '"claimed_by": "([^"]+)"').Matches.Groups[1].Value
$cl2   = ($ev2 | Select-String -Pattern '"claimed_by": "([^"]+)"').Matches.Groups[1].Value

Write-Host "worker-1 claim -> $ev1id (claimed_by=$cl1)"
Write-Host "worker-2 claim -> $ev2id (claimed_by=$cl2)"

if (-not $ev1id -or -not $ev2id) { Write-Host "FAIL: one worker got NULL"; exit 1 }
if ($ev1id -eq $ev2id) { Write-Host "FAIL: DOUBLE-CLAIM (same item)"; exit 1 }
foreach ($e in @($ev1id, $ev2id)) {
  if (@("evt_test_A_0001","evt_test_B_0002") -notcontains $e) { Write-Host "FAIL: unexpected event $e"; exit 1 }
}
if ($ev1id -eq $ev2id) { Write-Host "FAIL: both got same"; exit 1 }

Write-Host "PASS: 2 concurrent workers claimed DIFFERENT items (A+B)"
