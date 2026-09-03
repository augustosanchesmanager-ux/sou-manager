# Gera o script SQL de baixa (DRY-RUN) das comandas abertas ate 31/07/2026 - tenant Sanchez Barber.
# NAO executa nada; apenas gera o arquivo .sql para revisao do PO.
$root = "C:\SMG\04_PRODUTOS\SMG_BARBER\sou-manager"
$f = Join-Path $root "scripts\ops\regularizacao\dryrun-comandas-abertas-ate-2026-07-31.json"
$rows = ((Get-Content -LiteralPath $f -Raw) | ConvertFrom-Json).rows
$tenant = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'
$excluir = @(
  'd2845e32-a20c-47c7-9484-7992487c744b',
  'ac5711a5-5b84-4081-b4c2-b77fd7a192be',
  '00f8d667-77ef-4f34-aa4b-c361ad457768'
)
$keep = @()
foreach ($r in $rows) { if ($excluir -notcontains $r.comanda_id) { $keep += $r } }

$soma = 0.0
$porMes = @{}
foreach ($r in $keep) {
  $soma += [double]$r.saldo
  $mes = $r.data_comanda.Substring(0, 7)
  if (-not $porMes.ContainsKey($mes)) { $porMes[$mes] = 0.0 }
  $porMes[$mes] += [double]$r.saldo
}

$sb = [System.Text.StringBuilder]::new(300000)
[void]$sb.AppendLine('-- ============================================================')
[void]$sb.AppendLine('-- PLANO DE BAIXA FINANCEIRA - DRY-RUN (NAO EXECUTAR SEM AUTORIZACAO)')
[void]$sb.AppendLine("-- Tenant Sanchez Barber: $tenant")
[void]$sb.AppendLine('-- Mecanismo: finance_settle_comanda (quita: status->paid, transaction income, appointment completed, financial_effect=true)')
[void]$sb.AppendLine("-- Data de referencia: created_at da comanda (historica). Metodo: 'regularizacao'. Source: 'regularizacao'.")
[void]$sb.AppendLine("-- Comandas: $($keep.Count) | Soma a baixar: R$ $soma")
[void]$sb.AppendLine('-- Excluidas (saldo <= 0): d2845e32 (quitada 45), ac5711a5 (total 0), 00f8d667 (excesso 5)')
[void]$sb.AppendLine('-- ATENCAO: requer auth.uid() de gestao (admin/manager). Executar via API autenticada.')
[void]$sb.AppendLine('-- ============================================================')
[void]$sb.AppendLine('')
foreach ($r in $keep) {
  $id = $r.comanda_id
  $paid = [decimal]$r.saldo
  $date = $r.data_comanda
  [void]$sb.AppendLine("SELECT public.finance_settle_comanda('$tenant'::uuid, '$id'::uuid, 'regularizacao', $paid, '$date'::timestamptz, 'regularizacao', 'regularizacao financeira ate 31/07/2026', 'regularizacao-set-$($id.ToLower())');")
}
$out = Join-Path $root "scripts\ops\regularizacao\baixa-354-comandas-DRY-RUN.sql"
Set-Content -LiteralPath $out -Value $sb.ToString() -Encoding UTF8
Write-Output "GERADO_OK comandas=$($keep.Count) soma_rs=$soma arquivo=$out"
foreach ($m in ($porMes.Keys | Sort-Object)) { Write-Output ("  mes {0}: R$ {1}" -f $m, $porMes[$m]) }
