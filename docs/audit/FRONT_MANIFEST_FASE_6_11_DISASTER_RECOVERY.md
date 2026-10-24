# Front Manifest — Fase 6.11 Disaster Recovery

> Protocolo: SMG Change Control v1.0.0 (INTAKE → AUDIT → CLASSIFY → ISOLATE → IMPLEMENT → VALIDATE → COMMIT → PUSH → PR → CI → STOP/GATE)
> Conforme `docs/adr/ADR-028-smg-gate-formal-contract.md` e `.opencode/SMG_CHANGE_CONTROL.md`
> Data: 2026-10-24
> Autor: Antigravity

---

## Identificação

| Campo | Valor |
|---|---|
| Front ID | FASE-6.11-DISASTER-RECOVERY |
| Fase | Fase 6 — Production Readiness |
| Subfase | 6.11 Disaster Recovery |
| Base | `main` @ `d8301c0` (após merge do PR #177) |
| Branch | `feat/fase6-6-11-disaster-recovery` |
| Escopo | DRP formal (`docs/runbooks/DISASTER_RECOVERY_PLAN.md`), script operacional de backup (`scripts/ops/backup-prod.ps1`), configuração de `.gitignore` e atualização de manifestos |
| Escopo excluído | Migrações, RPCs, schema, código em `src/`, alteração de produção, testes destrutivos em banco remoto |
| Validação | Sintaxe PowerShell do script (`-DryRun` executado com exit code 0), `git diff --check`, `typecheck` e `build` |
| Deploy | não autorizado (MERGE ≠ DEPLOY PROD — ADR-026) |
| Estado atual | **VALIDATE — Pronto para revisão do PO e STOP/GATE de commit** |

---

## Objetivo da subfase

Estabelecer a política oficial de **Disaster Recovery (DRP)** da plataforma SMG Barber, definindo métricas auditáveis de **RPO** (24h em rotina / 0m em pré-deploy) e **RTO** (< 5m para frontend / < 60m para banco), documentando os 3 cenários de desastre (Frontend, Corrupção Lógica e Provedor) e fornecendo ferramental operacional padronizado para extração segura de dumps lógicos de Produção.

---

## Critérios de entrada

- [x] Base sincronizada com `main` (`d8301c0`).
- [x] Branch isolada `feat/fase6-6-11-disaster-recovery` criada.
- [x] Sem alterações concorrentes em banco ou infraestrutura.
- [x] Autorização explícita do PO para formalização da Subfase 6.11.

---

## Critérios de saída

- [x] DRP formal documentado em `docs/runbooks/DISASTER_RECOVERY_PLAN.md`.
- [x] Métricas oficiais de RPO (24h rotina / 0m pre-deploy) e RTO (< 60m banco / < 5m frontend) registradas.
- [x] 3 cenários de desastre (Frontend, Corrupção Lógica, Provedor) detalhados com fluxos de contenção e restauração.
- [x] Checklist de validação pós-restore (Auth, Multi-tenant RLS, Checkout, Agenda, Outbox, Observabilidade).
- [x] Script operacional padronizado criado em `scripts/ops/backup-prod.ps1` com checagem de CLI, modos (`-DataOnly`, `-RoleOnly`, `-SchemaOnly`, `-DryRun`), hashing SHA256 e segurança de credenciais.
- [x] Diretório `.backups/` adicionado ao `.gitignore`.
- [x] Zero exposição de segredos ou tokens hardcoded.
- [x] Nenhuma alteração em `src/`, migrations ou banco de dados.
- [x] `git diff --check` verificado sem erros.

---

## EVIDENCE

| # | Evidência |
|---|---|
| E1 | `docs/runbooks/DISASTER_RECOVERY_PLAN.md`: DRP completo cobrindo princípios, métricas RPO/RTO, 3 cenários de contingência, passo a passo pré-deploy, matriz de papéis e checklist de liberação. |
| E2 | `scripts/ops/backup-prod.ps1`: script PowerShell operacional seguro para automação de dumps lógicos via Supabase CLI (`ushsnmlbeurfvlkieiln`). |
| E3 | Validação de sintaxe PowerShell: execução de `backup-prod.ps1 -DryRun` executada com sucesso (Exit Code 0). |
| E4 | `.gitignore`: entrada `.backups/` adicionada na seção de utilitários locais. |
| E5 | `git diff --check`: 0 erros de whitespace ou formatação. |

---

## Log de transições

| Data | Transição | Ator | Observação |
|---|---|---|---|
| 2026-10-24 | INTAKE | Augusto (PO) | Solicitação formal da Subfase 6.11 (Disaster Recovery) |
| 2026-10-24 | ISOLATE | Antigravity | Criação da branch `feat/fase6-6-11-disaster-recovery` |
| 2026-10-24 | IMPLEMENT | Antigravity | DRP em `docs/runbooks/DISASTER_RECOVERY_PLAN.md`, `scripts/ops/backup-prod.ps1` e `.gitignore` |
| 2026-10-24 | VALIDATE | Antigravity | Validação de sintaxe PowerShell, teste DryRun, `git diff --check` limpo |
| 2026-10-24 | STOP/GATE | Antigravity | **PARADO — aguarda revisão do diff e autorização do PO para commit/push** |
