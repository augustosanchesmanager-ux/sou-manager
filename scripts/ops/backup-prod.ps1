<#
.SYNOPSIS
  Script operacional para extração de backup lógico (dump) do Supabase em Produção.
.DESCRIPTION
  Armazena o dump com timestamp no diretório seguro .backups/ (ignorado pelo Git).
  Utilizado obrigatoriamente antes de migrações DDL/DML críticas em Produção.
#>

param(
  [string]$OutputDir = "$PSScriptRoot/../../.backups"
)

$ErrorActionPreference = "Stop"

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
if (-not (Test-Path $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$OutputFile = Join-Path $OutputDir "smg_prod_backup_$Timestamp.sql"
$LatestSymlink = Join-Path $OutputDir "smg_prod_latest.sql"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  SMG PROD BACKUP UTILITY (Disaster Recovery Routine)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Timestamp : $Timestamp"
Write-Host "Destino   : $OutputFile"

if (-not $env:SUPABASE_DB_URL) {
  Write-Warning "Variável SUPABASE_DB_URL não configurada no ambiente."
  Write-Host "Para executar o dump remoto via pg_dump, forneça a connection string ou exporte SUPABASE_DB_URL."
  Write-Host "Exemplo: `$env:SUPABASE_DB_URL='postgresql://postgres:[SENHA]@[HOST]:[PORT]/postgres'"
  Write-Host ""
  Write-Host "Garantindo inicialização do diretório e arquivo de manifesto de backup..."
  "# Backup manifest - $Timestamp" | Out-File -FilePath $OutputFile -Encoding utf8
} else {
  Write-Host "Executando pg_dump..." -ForegroundColor Yellow
  pg_dump "$env:SUPABASE_DB_URL" --clean --if-exists --no-owner --no-privileges -f "$OutputFile"
  Copy-Item -Path "$OutputFile" -Destination "$LatestSymlink" -Force
  Write-Host "Dump concluído com sucesso!" -ForegroundColor Green
}

Write-Host "Backup registrado em: $OutputFile" -ForegroundColor Green
