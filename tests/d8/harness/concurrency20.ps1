# D8 concurrency stress — 20 concurrent workers, 2 pending items.
# Result required: exactly 2 effective claims, 18 NULL, no double-claim.
$ErrorActionPreference = "Continue"
$pg = if ($env:D8_CONTAINER) { $env:D8_CONTAINER } else { "d8harness-pg" }

# Ensure clean 2-pending state
docker exec $pg psql -U postgres -d d8test -c "DELETE FROM public.commission_records; UPDATE public.outbox_items SET status='pending', retry_attempts=0, retry_next_retry_at=NULL, retry_last_error=NULL, claimed_by=NULL, processing_started_at=NULL, completed_at=NULL, dispatched_at=NULL WHERE event_id IN ('evt_test_A_0001','evt_test_B_0002');" 2>$null | Out-Null

$jobs = @()
for ($i = 0; $i -lt 20; $i++) {
  $w = "worker-$i"
  $jobs += Start-Job -ScriptBlock {
    param($c, $wn)
    docker exec $c psql -U postgres -d d8test -t -A -c "SELECT public.claim_next_outbox_item(NULL::uuid, '$wn') AS c;" 2>$null
  } -ArgumentList @($pg, $w)
}

Wait-Job -Job $jobs -Timeout 60 | Out-Null

$claimed = @()
$nullCount = 0
foreach ($j in $jobs) {
  $res = Receive-Job -Job $j
  Remove-Job -Job $j -Force
  $combined = ($res | Where-Object { $_ }) -join "|"
  if ($combined -match '"event_id": "([^"]+)"') {
    $eid = $matches[1]
    $worker = if ($combined -match '"claimed_by": "([^"]+)"') { $matches[1] } else { "?" }
    $claimed += [PSCustomObject]@{ event = $eid; worker = $worker }
  } else {
    $nullCount++
  }
}

Write-Host "Effective claims: $($claimed.Count)  |  NULL results: $nullCount"
foreach ($c in $claimed) { Write-Host "  -> $($c.worker) claimed $($c.event)" }

$distinct = $claimed | ForEach-Object { $_.event } | Sort-Object -Unique
$evIds = @("evt_test_A_0001","evt_test_B_0002")

if ($claimed.Count -ne 2) { Write-Host "FAIL: expected exactly 2 effective claims, got $($claimed.Count)"; exit 1 }
if ($distinct.Count -ne 2) { Write-Host "FAIL: expected 2 DISTINCT items, got $($distinct -join ',')"; exit 1 }
foreach ($d in $distinct) { if ($evIds -notcontains $d) { Write-Host "FAIL: unexpected event $d"; exit 1 } }
if ($nullCount -ne 18) { Write-Host "FAIL: expected 18 NULL, got $nullCount"; exit 1 }

Write-Host "PASS: 20 concurrent workers -> 2 effective distinct claims (A+B), 18 NULL, NO double-claim"
