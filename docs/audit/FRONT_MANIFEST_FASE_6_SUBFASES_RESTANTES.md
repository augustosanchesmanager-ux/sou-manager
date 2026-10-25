# Front Manifest — Fase 6: Production Readiness (Subfases Restantes)

> Protocolo: SMG Change Control v1.0.0 (INTAKE → AUDIT → CLASSIFY → STOP → ISOLATE → ...)
> Conforme `docs/adr/ADR-028-smg-gate-formal-contract.md` e `.opencode/SMG_CHANGE_CONTROL.md`
> Data: 2026-10-23
> Autor: Sisyphus (OpenCode)
> Base: `main` (commit `42f34bc` — merge do PR #172)

## Identificação

| Campo | Valor |
|-------|-------|
| Front ID | FASE-6-SUBFASES-RESTANTES |
| Fase | Fase 6 — Production Readiness |
| Base | `main` (commit `42f34bc`) |
| Branch | não criada ainda (aguarda STOP/GATE para ISOLATE) |
| Escopo | Subfases 6.2 Observabilidade, 6.3 Ambientes, 6.5 E2E Críticos, 6.7 Release Notes, 6.8 Documentação Operacional, 6.9 Health Checks, 6.10 Backup, 6.11 Disaster Recovery, 6.12 Deploy Validation, 6.13 Production Certification |
| Escopo excluído | 6.6 Deploy Produção (bloqueado — exige autorização separada do PO); qualquer mudança estrutural sem ADR; deploy em produção sem autorização; aplicação de migration em PROD sem autorização |
| Checkpoint inicial | STOP/GATE após CLASSIFY (aguarda autorização do PO para selecionar subfase inicial) |
| Commit de implementação | não criado ainda |
| Validação | pendente |
| PR | não criado |
| CI/E2E | não executado para esta front |
| Merge SHA | não aplicável |
| Deploy | não autorizado (MERGE ≠ DEPLOY PROD — ADR-026) |
| Post-deploy verdict | não aplicável |
| Estado atual | **CONCLUÍDO — Todas as subfases da Fase 6 entregues e mergiadas em main** |

## Subfases e status (atualizado em 2026-10-24)

| Subfase | Status | Observação |
|---------|--------|------------|
| 6.1 CI/CD | ✅ 100% | Concluída (PR #172) |
| 6.2 Observabilidade | ✅ 100% | Concluída (PR #173 — ErrorBoundary, global handlers, redaction) |
| 6.3 Ambientes | ✅ 100% | Concluída (PR #174 — `docs/ambientes.md`) |
| 6.4 Hardening | ✅ 100% | Concluída (PR #172) |
| 6.5 E2E Críticos | ✅ 100% | Concluída (PR #177 — P1 Checkout, P2 Split de Comissão, P3 RLS Leak) |
| 6.6 Deploy Produção | 🟢 100% | Automação pronta via `.github/workflows/deploy-production.yml` (PO gated) |
| 6.7 Release Notes | ✅ 100% | Concluída (PR #178 — template e release v1.5.0) |
| 6.8 Documentação Operacional | ✅ 100% | Concluída (PR #178 — incidentes, rollback, segredos, D8) |
| 6.9 Health Checks | ✅ 100% | Concluída (PR #175 — endpoint `/health` e docs operacionais) |
| 6.10 Backup | ✅ 100% | Concluída (PR #178 / PR #179 — script operacional `backup-prod.ps1`) |
| 6.11 Disaster Recovery | ✅ 100% | Concluída (PR #179 — `docs/runbooks/DISASTER_RECOVERY_PLAN.md`) |
| 6.12 Deploy Validation | ✅ 100% | Concluída (PR #176 — isolamento do job post-validate) |
| 6.13 Production Certification | ✅ 100% | Concluída — Dossiê aprovado |

## Sequência recomendada (proposta ao PO)

| Ordem | Subfase | Justificativa |
|-------|---------|---------------|
| 1 | 6.3 Ambientes | Fundacional; documenta Development/Preview/Demo/Staging/Production |
| 2 | 6.9 Health Checks | Endpoint `/health` simples; requisito de 6.13 |
| 3 | 6.2 Observabilidade (produção) | Sentry, correlation IDs, error boundary global |
| 4 | 6.5 E2E Críticos | Suíte de fluxos críticos P0/P1 |
| 5 | 6.7 Release Notes | Script + formato |
| 6 | 6.8 Documentação Operacional | Ambientes, aprovação de deploy, segredos, procedimentos |
| 7 | 6.10 Backup / 6.11 Disaster Recovery | Plano e teste de restauração |
| 8 | 6.12 Deploy Validation | Corrigir condição do `deploy-validate.yml` |
| 9 | 6.13 Production Certification | Checklist final + sign-off |

## Regras aplicáveis a esta front

- Nunca alterar produção durante investigação.
- Nunca aplicar migration, mudar RLS/RPC/policy de segurança, ou mutar dados de produção sem autorização explícita do PO.
- Nunca misturar frentes não relacionadas na mesma implementação, commit ou PR.
- Nunca commit de working tree não verificado/misto.
- Nunca push sem autorização explícita.
- Nunca merge enquanto gate obrigatório está vermelho/desconhecido/bypassado.
- Sempre preservar multi-tenancy e isolamento de tenant_id.
- Sempre distinguir EVIDENCE / INTERPRETATION / GAP / DECISION / STATUS.
- Sempre rodar `git diff --check` antes de commit.
- Preferir mudanças mínimas e reversíveis.
- STOP sempre que decisão, autorização, ambiente, escopo ou evidência estiver faltando.
- Dados financeiros, permissões, RLS, RPCs, migrations e produção são de alto risco por padrão.

---

## Log de transições

| Data | Transição | Ator | Observação |
|------|-----------|------|------------|
| 2026-10-23 | INTAKE | Sisyphus | Front identificada, escopo definido (subfases restantes da Fase 6) |
| 2026-10-23 | AUDIT | Sisyphus | Estado verificado via `ci.yml`, `deploy-production.yml`, `deploy-validate.yml`, `vercel.json`, `src/lib/observability/`, `docs/runbooks/` |
| 2026-10-23 | CLASSIFY | Sisyphus | Classificado: front de implementação, múltiplas subfases independentes, baixo risco arquitetural (não altera arquitetura congelada), 6.6 bloqueado por PO |
| 2026-10-23 | STOP/GATE | Sisyphus | **PARADO — aguarda autorização do PO para selecionar subfase inicial** |
| 2026-10-24 | IMPLEMENT | Antigravity | Subfases 6.7, 6.8, 6.10, 6.11, 6.12 e 6.13 implementadas, testadas e integradas (PRs #175, #176, #177, #178, #179) |
| 2026-10-24 | CLOSE | PO (Augusto) | Fase 6 concluída e certificada 100%. Transição oficial para Fase 7 (Product Maturity). |

---

## Próxima transição permitida

**FASE 7 — Product Maturity (7.1 UX Review em andamento).**

**STATUS:** CONCLUÍDO
