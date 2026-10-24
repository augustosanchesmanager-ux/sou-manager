<#
.SYNOPSIS
  Utilitario operacional seguro para extracao de dumps logicos de Producao/Staging.
  Subfase 6.11 (Disaster Recovery) - SMG Platform.

.DESCRIPTION
  Executa dump logico do banco de dados remoto via Supabase CLI, aplicando timestamp
  padronizado e salvando o artefato no diretorio seguro '.backups/' (ignorado no Git).
  Suporta extracao completa (schema + dados), somente dados (--data-only) ou somente roles.

  Metricas DRP atendidas:
   - RPO pre-deploy: 0 minutos (backup obrigatorio antes de migrations/deploy).
   - RTO banco de dados: < 60 minutos para restore logico.

.PARAMETER ProjectRef
  Project ID do Supabase. Padrao: ushsnmlbeurfvlkieiln (PROD).
  Para Staging utilize: tjcvuhynckocmvtqykxp.

.PARAMETER OutputDir
  Diretorio para salvar o dump. Padrao: '.backups'.

.PARAMETER Schema
  Lista separada por virgula de schemas para incluir. Padrao: 'public,barber'.

.PARAMETER DataOnly
  Se ativo, exporta estritamente os dados (sem DDL de tabelas/funcoes).

.PARAMETER RoleOnly
  Se ativo, exporta somente os cluster roles.

.PARAMETER SchemaOnly
  Se ativo, exporta somente a estrutura DDL sem dados.

.PARAMETER DryRun
  Se ativo, exibe o comando que seria executado sem acionar a extracao real.

.EXAMPLE
  .\scripts\ops\backup-prod.ps1
  Executa backup padrao (schema + dados de public,barber) de Producao.

.EXAMPLE
  .\scripts\ops\backup-prod.ps1 -ProjectRef "tjcvuhynckocmvtqykxp"
  Executa backup do ambiente de Staging.

.EXAMPLE
  .\scripts\ops\backup-prod.ps1 -DryRun
  Valida parametros e visualiza o comando sem executar.
#>

[CmdletBinding()]
param(
  [string]$ProjectRef = "ushsnmlbeurfvlkieiln",
  [string]$OutputDir = ".backups",
  [string]$Schema = "public,barber",
  [switch]$DataOnly,
  [switch]$RoleOnly,
  [switch]$SchemaOnly,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  SMG Platform - Disaster Recovery Backup Tool (Subfase 6.11)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Verificacao de Pre-requisitos
Write-Host "[1/4] Verificando pre-requisitos do ambiente..." -ForegroundColor Yellow

$supabaseCmd = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $supabaseCmd) {
  Write-Error "Supabase CLI nao encontrado no PATH. Instale via: npm i -g supabase ou consulte https://supabase.com/docs/guides/cli"
  exit 1
}

$cliVersion = supabase --version 2>$null
Write-Host ("  -> Supabase CLI detectado (versao: {0})" -f $cliVersion) -ForegroundColor Green

# 2. Resolucao de Diretorios
Write-Host "[2/4] Preparando diretorio de backup..." -ForegroundColor Yellow

# Localizar raiz do repositorio a partir da localizacao do script
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)

if (-not (Test-Path (Join-Path $RepoRoot "package.json"))) {
  # Fallback caso executado a partir da raiz
  $RepoRoot = (Get-Location).Path
}

$TargetDir = Join-Path $RepoRoot $OutputDir
if (-not (Test-Path $TargetDir)) {
  New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
  Write-Host ("  -> Diretorio criado: {0}" -f $TargetDir) -ForegroundColor Green
} else {
  Write-Host ("  -> Diretorio verificado: {0}" -f $TargetDir) -ForegroundColor Green
}

# 3. Definicao do Nome do Artefato
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$ModeTag = if ($DataOnly) { "data" } elseif ($RoleOnly) { "roles" } elseif ($SchemaOnly) { "schema" } else { "full" }
$Filename = ("backup_{0}_{1}_{2}.sql" -f $ProjectRef, $ModeTag, $Timestamp)
$OutputFile = Join-Path $TargetDir $Filename

Write-Host ("  -> Arquivo alvo: {0}" -f $OutputFile) -ForegroundColor Cyan
Write-Host ("  -> Project Ref: {0}" -f $ProjectRef) -ForegroundColor Cyan
Write-Host ("  -> Schemas: {0}" -f $Schema) -ForegroundColor Cyan

# 4. Construcao dos Argumentos
$dumpArgs = @(
  "db", "dump",
  "--project-ref", $ProjectRef,
  "--file", $OutputFile,
  "--keep-comments"
)

if ($DataOnly) {
  $dumpArgs += "--data-only"
  $dumpArgs += "--use-copy"
} elseif ($RoleOnly) {
  $dumpArgs += "--role-only"
} elseif ($SchemaOnly) {
  # Dump default do supabase sem --data-only ja inclui DDL
}

if (-not $RoleOnly -and [string]::IsNullOrWhiteSpace($Schema) -eq $false) {
  $dumpArgs += @("--schema", $Schema)
}

if ($env:SUPABASE_DB_PASSWORD) {
  $dumpArgs += @("--password", $env:SUPABASE_DB_PASSWORD)
  Write-Host "  -> Variavel SUPABASE_DB_PASSWORD detectada para autenticacao remota." -ForegroundColor Green
} else {
  Write-Host "  -> SUPABASE_DB_PASSWORD nao definida; o CLI utilizara sessao ativa ou solicitara senha interativamente se necessario." -ForegroundColor Yellow
}

if ($DryRun) {
  Write-Host "`n[DRY-RUN] Comando que seria executado:" -ForegroundColor Magenta
  # Mascarar senha caso esteja nos argumentos exibidos
  $sanitizedArgs = @()
  for ($i = 0; $i -lt $dumpArgs.Count; $i++) {
    if ($dumpArgs[$i] -eq "--password") {
      $sanitizedArgs += "--password"
      $sanitizedArgs += "********"
      $i++
    } else {
      $sanitizedArgs += $dumpArgs[$i]
    }
  }
  Write-Host ("supabase {0}" -f ($sanitizedArgs -join ' ')) -ForegroundColor White
  Write-Host "`nOperacao DRY-RUN concluida com sucesso (nenhum arquivo gerado)." -ForegroundColor Green
  exit 0
}

# 5. Execucao do Dump
Write-Host "`n[3/4] Executando dump do banco de dados remoto..." -ForegroundColor Yellow
$sw = [System.Diagnostics.Stopwatch]::StartNew()

try {
  & supabase @dumpArgs
  $sw.Stop()

  if ($LASTEXITCODE -ne 0) {
    Write-Error ("Falha ao executar dump via Supabase CLI (Exit Code: {0})." -f $LASTEXITCODE)
    exit $LASTEXITCODE
  }
} catch {
  Write-Error ("Excecao ao invocar dump: {0}" -f $_)
  exit 1
}

# 6. Validacao e Telemetria do Backup
Write-Host "`n[4/4] Validando integridade do artefato..." -ForegroundColor Yellow

if (-not (Test-Path $OutputFile)) {
  Write-Error ("Arquivo de backup nao foi encontrado apos o dump: {0}" -f $OutputFile)
  exit 1
}

$fileItem = Get-Item $OutputFile
$fileSizeMB = [Math]::Round(($fileItem.Length / 1MB), 2)
$fileSizeKB = [Math]::Round(($fileItem.Length / 1KB), 2)
$hash = (Get-FileHash -Path $OutputFile -Algorithm SHA256).Hash

Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  BACKUP CONCLUIDO COM SUCESSO!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host ("  Arquivo:    {0}" -f $OutputFile)
Write-Host ("  Tamanho:    {0} MB ({1} KB)" -f $fileSizeMB, $fileSizeKB)
Write-Host ("  SHA256:     {0}" -f $hash)
Write-Host ("  Duracao:    {0:N2} segundos" -f $sw.Elapsed.TotalSeconds)
Write-Host ("  Timestamp:  {0}" -f $Timestamp)
Write-Host "----------------------------------------------------------"
Write-Host "  [ATENCAO] Guarde este hash SHA256 para verificacao de integridade pos-restore." -ForegroundColor Cyan
Write-Host "  Consulte o DRP oficial em: docs/runbooks/DISASTER_RECOVERY_PLAN.md" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Green

exit 0
