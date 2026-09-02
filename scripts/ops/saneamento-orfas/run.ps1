# =============================================================================
# RODA: Supabase -- Linked project
# Use: supabase db query --linked -f <file>.sql -o json
# -----------------------------------------------------------------------------
# runner principal do SANEAMENTO DE COMANDAS ORFAS (tenant Sanchez Barber).
#
# MODOS:
#   .\run.ps1 -preflight                 # 100% read-only: valida invariantes A+B
#   .\run.ps1 -execute -fase all  -approveA -approveB   # A -> postA -> captureB -> B -> postB
#   .\run.ps1 -execute -fase a    -approveA             # somente FASE A
#   .\run.ps1 -execute -fase b    -approveB             # somente FASE B
#
# SEGURANCA:
#   -preflight NUNCA executa DML (so preflight.sql/postflight-*.sql read-only).
#   -execute exige -approveA e/ou -approveB explicito; sem a flag a fase aborta.
#   FASE B so roda se FASE A (quando -fase all) concluir com post-gate A OK.
#   ANTES da FASE B, o runner executa capture-b.sql (read-only) e materializa a
#   IDENTIDADE do lote (25 comanda_ids) num artefato; o post-gate B valida o
#   estado desses MESMOS 25 ids (regra de ouro: identidade do lote != estado final).
#   Cada fase re-executa os guards (RAISE EXCEPTION) imediatamente antes do
#   UPDATE, dentro do proprio arquivo .sql.
#   Log auditavel gravado em scripts/ops/saneamento-orfas/logs/ (sem secrets).
#
# CONEXAO: supabase CLI ja linkado ao projeto (ref ushsnmlbeurfvlkieiln) e
#          autenticado. NENHUMA credencial e passada pelo runner nem gravada
#          no repositorio.
# =============================================================================
param(
    [switch]$preflight,
    [switch]$execute,
    [ValidateSet('all','a','b')][string]$fase = 'all',
    [switch]$approveA,
    [switch]$approveB,
    [switch]$dryrun,
    [string]$logDir = "$PSScriptRoot\logs"
)

$ErrorActionPreference = 'Stop'

# guarda estrutural: preflight e execute sao mutuamente exclusivos
if ($preflight -and $execute) {
    Write-Error "Modos -preflight e -execute sao mutuamente exclusivos."
    exit 2
}
if (-not $preflight -and -not $execute) {
    Write-Error "Informe -preflight ou -execute."
    exit 2
}

$scriptName  = Split-Path -Leaf $MyInvocation.MyCommand.Path
$workDir     = $PSScriptRoot
$tenant      = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'
$ref         = 'ushsnmlbeurfvlkieiln'

# ---- logging auditavel (sem secrets) ----------------------------------------
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$mode  = if ($preflight) { 'preflight' } else { 'execute' }
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
$logFile = Join-Path $logDir ("saneamento-{0}-{1}.log" -f $mode, $stamp)

function Write-Log {
    param([string]$msg)
    $line = "{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
    Write-Host $line
    Add-Content -LiteralPath $logFile -Value $line
}

function Invoke-Sql {
    # Executa um arquivo .sql via `supabase db query --linked`, retornando o JSON.
    # Em -dryrun, apenas imprime o comando e devolve $null (nao toca o banco).
    # `file` pode ser o nome em $workDir OU um caminho absoluto (ex.: postflight-b temp).
    param([string]$file, [string]$label)
    $fPath = if ([System.IO.Path]::IsPathRooted($file)) { $file } else { Join-Path $workDir $file }
    if (-not (Test-Path $fPath)) { Write-Error "Arquivo nao encontrado: $fPath" }
    if ($dryrun) {
        Write-Log "[DRYRUN] (nao executado) supabase db query --linked -f $file -o json"
        return $null
    }
    Write-Log "[$label] executando $file ..."
    # O CLI (via shim supabase.ps1) escreve "Initialising login role..." no stderr.
    # Com $ErrorActionPreference='Stop' no topo, PS 5.1 converte stderr em erro
    # terminante (NativeCommandError) mesmo com 2>. Por isso escopamos
    # ErrorActionPreference='Continue' durante a chamada nativa e validamos via
    # $LASTEXITCODE + stdout JSON. stderr vai para arquivo temp (nunca log de secrets).
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $errFile = Join-Path $logDir ("err_{0}.tmp" -f [IO.Path]::GetFileNameWithoutExtension($file))
        $null = supabase db query --linked -f $fPath -o json 2> $errFile | Tee-Object -Variable stdout
    } finally {
        $ErrorActionPreference = $prevEap
    }
    $stderr = if (Test-Path $errFile) { Get-Content -LiteralPath $errFile -Raw } else { '' }
    if ($LASTEXITCODE -ne 0) {
        Write-Log "[$label] FALHOU. ExitCode=$LASTEXITCODE"
        if ($stderr) { Write-Log "[$label] stderr: $stderr" }
        throw "Falha ao executar $file (exit $LASTEXITCODE). Veja log."
    }
    if ($stderr) { Write-Log "[$label] (stderr nao-protocolo): $stderr" }
    Write-Log "[$label] concluido (exit 0)."
    return ($stdout -join "`n")
}

function Assert-Invariants {
    # Valida o JSON do preflight com as expectativas de FASE A e B.
    param($json, [int]$esperadoA, [int]$esperadoB)
    if (-not $json) { Write-Log "ASSERT: sem JSON para validar."; return $false }
    # o CLI emite JSON top-level valido: {"boundary":..,"rows":[{...}],"warning":..}
    # Assim, parseamos tudo e acessamos .rows[0] (sem regex fragil).
    try {
        $parsed = $json | ConvertFrom-Json
    } catch {
        Write-Log "ASSERT: JSON invalido do CLI -> $($_.Exception.Message)"
        return $false
    }
    if (-not $parsed -or -not $parsed.rows -or $parsed.rows.Count -lt 1) {
        Write-Log "ASSERT: nenhuma linha rows no JSON."
        return $false
    }
    $o = $parsed.rows[0]

    # scriptblock delegate p/ checagem (evita funcao aninhada -- parser do PS)
    $Chk = {
        param($name, $got, $want)
        $g = [int]$got; $w = [int]$want
        if ($g -ne $w) {
            Write-Log ("[INVARIANTE '{0}'] esperado {1}, encontrado {2} -> FALHOU" -f $name, $w, $g)
            return $false
        }
        Write-Log ("[INVARIANTE '{0}'] OK ({1} = {2})" -f $name, $g, $w)
        return $true
    }

    $ok = $true
    $ok = (& $Chk 'a_alvos'                 $o.metric_a_alvos                      $esperadoA) -and $ok
    # FASE A consolidada (ja aplicada): 0 alvos restam com membership=true.
    $ok = (& $Chk 'a_flags_true'            $o.metric_a_flags_true                 0)          -and $ok
    $ok = (& $Chk 'a_itens_unit_price_zero' $o.metric_a_itens_unit_price_zero      0)          -and $ok
    $ok = (& $Chk 'a_assinatura_covering'   $o.metric_a_assinatura_covering_created_at 0)     -and $ok

    $ok = (& $Chk 'b_alvos'                 $o.metric_b_alvos                      $esperadoB) -and $ok
    $ok = (& $Chk 'b_status_open'           $o.metric_b_status_open                $esperadoB) -and $ok
    $ok = (& $Chk 'b_appointment_cancelled' $o.metric_b_appointment_cancelled      $esperadoB) -and $ok
    $ok = (& $Chk 'b_financial_effect_true' $o.metric_b_financial_effect_true      $esperadoB) -and $ok
    $ok = (& $Chk 'b_transactions'          $o.metric_b_transactions               0)          -and $ok
    $ok = (& $Chk 'b_paid'                  $o.metric_b_paid                       0)          -and $ok
    $ok = (& $Chk 'b_excecoes_presentes'    $o.metric_b_excecoes_presentes         0)          -and $ok
    $ok = (& $Chk 'b_cancellation_type_col' $o.metric_b_cancellation_type_col      1)          -and $ok

    return $ok
}

# -----------------------------------------------------------------------------
# VALIDADORES DE POS-GATE (separados por fase; cada um prova so o seu escopo)
# -----------------------------------------------------------------------------

# Reutiliza o parser JSON do CLI em qualquer assert metric_post_*.
function Get-JsonRow {
    param($json, [string]$ctx)
    if (-not $json) { Write-Log "${ctx}: sem JSON para validar."; return $null }
    try { $parsed = $json | ConvertFrom-Json } catch {
        Write-Log "${ctx}: JSON invalido do CLI -> $($_.Exception.Message)"; return $null
    }
    if (-not $parsed -or -not $parsed.rows -or $parsed.rows.Count -lt 1) {
        Write-Log "${ctx}: nenhuma linha rows no JSON."; return $null
    }
    return $parsed.rows[0]
}

# POST-GATE A: valida EXCLUSIVAMENTE as invariantes da FASE A.
# 24 alvos membership=false; 0 restam true; 0 unit_price=0; 0 assinatura cobrindo created_at.
function Assert-PostflightA {
    param($json)
    $o = Get-JsonRow -json $json -ctx 'POST-GATE A'
    if ($null -eq $o) { return $false }
    $Chk = {
        param($name, $got, $want)
        $g = [int]$got; $w = [int]$want
        if ($g -ne $w) {
            Write-Log ("[POST-GATE A '{0}'] esperado {1}, encontrado {2} -> FALHOU" -f $name, $w, $g)
            return $false
        }
        Write-Log ("[POST-GATE A '{0}'] OK ({1} = {2})" -f $name, $g, $w)
        return $true
    }
    $ok = $true
    $ok = (& $Chk 'a_alvos_membership_false'      $o.metric_post_a_alvos_membership_false 24) -and $ok
    $ok = (& $Chk 'a_restam_true'                 $o.metric_post_a_restam_true            0)  -and $ok
    $ok = (& $Chk 'a_unit_price_zero'             $o.metric_post_a_unit_price_zero        0)  -and $ok
    $ok = (& $Chk 'a_assinatura_covering'         $o.metric_post_a_assinatura_covering_created_at 0) -and $ok
    return $ok
}

# POST-GATE B: valida o estado dos MESMOS ids capturados no lote B (identidade).
# total_capturado=25; todos cancelled; 0 open; 0 nao-cancelled; 0 nao-appointment-cancelled;
# 0 financial_effect-nao-true; 0 transactions; 0 paid; 0 excecoes presentes no lote.
function Assert-PostflightB {
    param($json)
    $o = Get-JsonRow -json $json -ctx 'POST-GATE B'
    if ($null -eq $o) { return $false }
    $Chk = {
        param($name, $got, $want)
        $g = [int]$got; $w = [int]$want
        if ($g -ne $w) {
            Write-Log ("[POST-GATE B '{0}'] esperado {1}, encontrado {2} -> FALHOU" -f $name, $w, $g)
            return $false
        }
        Write-Log ("[POST-GATE B '{0}'] OK ({1} = {2})" -f $name, $g, $w)
        return $true
    }
    $ok = $true
    $ok = (& $Chk 'b_total_capturado'                  $o.metric_post_b_total_capturado               25) -and $ok
    $ok = (& $Chk 'b_alvos_cancelled'                  $o.metric_post_b_alvos_cancelled               25) -and $ok
    $ok = (& $Chk 'b_restam_open'                      $o.metric_post_b_restam_open                   0)  -and $ok
    $ok = (& $Chk 'b_nao_cancelled'                    $o.metric_post_b_nao_cancelled                 0)  -and $ok
    $ok = (& $Chk 'b_nao_appointment_cancelled'        $o.metric_post_b_nao_appointment_cancelled     0)  -and $ok
    $ok = (& $Chk 'b_financial_effect_nao_true'        $o.metric_post_b_financial_effect_nao_true     0)  -and $ok
    $ok = (& $Chk 'b_transactions'                     $o.metric_post_b_transactions                  0)  -and $ok
    $ok = (& $Chk 'b_paid'                             $o.metric_post_b_paid                          0)  -and $ok
    $ok = (& $Chk 'b_excecoes_presentes'               $o.metric_post_b_excecoes_presentes            0)  -and $ok
    return $ok
}

# Captura a IDENTIDADE do lote B: executa capture-b.sql (read-only), extrai os
# comanda_ids, grava um ARTEFATO DE EXECUCAO (lista de UUIDs) e devolve a lista.
# Em -dryrun, nao toca o banco e devolve lista vazia.
function Capture-LoteB {
    $json = Invoke-Sql 'capture-b.sql' 'CAPTURE B'
    if ($dryrun) {
        Write-Log "[CAPTURE B] (dryrun) nao capturou ids; artefato vazio."
        return @()
    }
    $o = Get-JsonRow -json $json -ctx 'CAPTURE B'
    if ($null -eq $o) { throw 'CAPTURE B: sem rows. Abortando antes da FASE B.' }
    # capture-b emite uma linha por comanda (rows). Extrai comanda_id de cada row.
    $parsed = $json | ConvertFrom-Json
    if (-not $parsed.rows -or $parsed.rows.Count -lt 1) {
        throw 'CAPTURE B: nenhum comanda_id encontrado. Abortando antes da FASE B.'
    }
    $ids = @($parsed.rows | ForEach-Object { [string]$_.comanda_id })
    $ids = @($ids | Where-Object { $_ -and $_ -ne '' } | Select-Object -Unique)
    Write-Log "[CAPTURE B] capturados $($ids.Count) comanda_id(s) do lote B."
    # Garante EXATAMENTE 25 (guarda de identidade antes da FASE B).
    if ($ids.Count -ne 25) {
        throw "CAPTURE B: esperado exatamente 25 ids, capturados $($ids.Count). Abortando."
    }
    # Grava artefato de execucao (lista pura, sem secrets) para auditoria.
    $artefato = Join-Path $logDir ("lote-b-capturado-{0}.json" -f $stamp)
    ($ids | ConvertTo-Json) | Set-Content -LiteralPath $artefato -Encoding UTF8
    Write-Log "[CAPTURE B] artefato gravado em: $artefato"
    return $ids
}

# Injeta a lista de ids do lote B no postflight-b.sql (substitui __LOTE_B_IDS__)
# e devolve um arquivo .sql temporario pronto para executar.
function Build-PostflightB {
    param([string[]]$ids)
    $src = Get-Content -LiteralPath (Join-Path $workDir 'postflight-b.sql') -Raw
    if ($ids.Count -eq 0) {
        # dryrun: usa placeholder nao-resolvido (nao executa de fato)
        $inList = "('__LOTE_B_IDS__')"
    } else {
        $quoted = $ids | ForEach-Object { "'{0}'" -f $_ }
        $inList = "(" + ($quoted -join ',') + ")"
    }
    $out = $src.Replace('__LOTE_B_IDS__', $inList)
    $tmpFile = Join-Path $logDir ("postflight-b-{0}.sql" -f $stamp)
    Set-Content -LiteralPath $tmpFile -Value $out -Encoding ASCII
    return $tmpFile
}

# -----------------------------------------------------------------------------
Write-Log "==== SANEAMENTO ORFAS -- inicio ===="
Write-Log "modo   : $mode"
Write-Log "fase   : $fase"
Write-Log "tenant : $tenant"
Write-Log "projeto linkado: $ref"
if ($dryrun) { Write-Log "ATENCAO: -dryrun ativo. NENHUM comando tocara o banco." }

if ($preflight) {
    Write-Log "---- PRE-FLIGHT (read-only) ----"
    $json = Invoke-Sql 'preflight.sql' 'PREFLIGHT'
    if ($dryrun) {
        # em dryrun validamos apenas a infraestrutura (nao as metricas)
        Write-Log "DRYRUN: preflight ok (sem tocar o banco)."
        Write-Log "Log gravado em: $logFile"
        exit 0
    }
    $okAll = Assert-Invariants -json $json -esperadoA 24 -esperadoB 25
    if ($okAll) {
        Write-Log "==== PRE-FLIGHT APROVADO: invariantes A(24) e B(25) confirmados ===="
        Write-Log "Log gravado em: $logFile"
        exit 0
    } else {
        Write-Log "==== PRE-FLIGHT REPROVADO: alguma invariante divergiu. NAO executar. ===="
        Write-Log "Log gravado em: $logFile"
        exit 1
    }
}

# ---------------- EXECUTE ----------------
if ($execute) {
    Write-Log "---- EXECUTE ----"

    # Guarda de aprovacao explicita
    if ($fase -in @('all','a') -and -not $approveA) {
        Write-Log "APROVACAO AUSENTE para FASE A. Abortando. (use -approveA)"
        exit 2
    }
    if ($fase -in @('all','b') -and -not $approveB) {
        Write-Log "APROVACAO AUSENTE para FASE B. Abortando. (use -approveB)"
        exit 2
    }

    # 0) pre-flight obrigatorio antes de qualquer mutacao
    Write-Log "-- pre-flight (guards) --"
    $pre = Invoke-Sql 'preflight.sql' 'PREFLIGHT'
    if (-not $dryrun) {
        $okAll = Assert-Invariants -json $pre -esperadoA 24 -esperadoB 25
        if (-not $okAll) {
            Write-Log "PRE-FLIGHT REPROVADO. NENHUMA fase sera executada."
            exit 1
        }
    }

    # FASE A
    if ($fase -in @('all','a')) {
        Write-Log "== FASE A : membership_credit_effect true->false (24) =="
        Invoke-Sql 'fase-a.sql' 'FASE A' | Out-Null
        # post-gate A exigido apos a FASE A; valida SOMENTE as invariantes A
        Write-Log "-- post-gate A (somente invariantes A) --"
        $postA = Invoke-Sql 'postflight-a.sql' 'POST A'
        if (-not $dryrun) {
            if (-not (Assert-PostflightA -json $postA)) {
                Write-Log "POST-GATE A REPROVADO. FASE B NAO sera executada."
                exit 1
            }
            Write-Log "POST-GATE A APROVADO."
        }
    }

    # FASE B (so quando -fase all|b; em all, ja passou pelo post-gate A)
    if ($fase -in @('all','b')) {
        if ($fase -eq 'all' -and $dryrun) {
            Write-Log "[dryrun] prosseguindo para FASE B (pulo do post-gate efetivo)."
        }
        # Antes de mutar: captura a IDENTIDADE do lote B (25 ids) e grava artefato.
        # Regra de ouro: identidade do lote != estado final do lote.
        Write-Log "== CAPTURE B : identidade do lote (25) =="
        $loteB = Capture-LoteB
        if (-not $dryrun -and $loteB.Count -ne 25) {
            Write-Log "CAPTURE B REPROVADO (esperado 25, capturado $($loteB.Count)). FASE B NAO sera executada."
            exit 1
        }
        Write-Log "== FASE B : status open->cancelled (25) =="
        Invoke-Sql 'fase-b.sql' 'FASE B' | Out-Null
        # post-gate B: prova o estado dos MESMOS 25 ids capturados
        Write-Log "-- post-gate B (25 ids capturados) --"
        $postBFile = Build-PostflightB -ids $loteB
        $postB = Invoke-Sql $postBFile 'POST B'
        if (-not $dryrun) {
            if (-not (Assert-PostflightB -json $postB)) {
                Write-Log "POST-GATE B REPROVADO."
                exit 1
            }
            Write-Log "POST-GATE B APROVADO."
        }
    }

    Write-Log "==== EXECUTE CONCLUIDO. Post-gates A e B aprovados. ===="
    Write-Log "Log gravado em: $logFile"
    exit 0
}
