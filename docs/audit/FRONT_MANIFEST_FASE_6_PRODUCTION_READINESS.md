# Front Manifest — Fase 6: Production Readiness

> Protocolo: SMG Change Control v1.0.0 (INTAKE → AUDIT → CLASSIFY → STOP → ...)
> Conforme `docs/adr/ADR-028-smg-gate-formal-contract.md` e `.opencode/SMG_CHANGE_CONTROL.md`
> Data: 2026-10-23
> Autor: Sisyphus (OpenCode)

## Identificação

| Campo | Valor |
|-------|-------|
| Front ID | FASE-6-PRODUCTION-READINESS |
| Fase | Fase 6 — Production Readiness |
| Base | `main` (commit atual: `5fef539`) |
| Branch | feat/fase6-production-readiness (worktree isolado, base main `5fef539`) |
| Escopo | Subfases 6.1 CI/CD, 6.2 Observabilidade, 6.3 Ambientes, 6.4 Hardening, 6.5 E2E Críticos, 6.6 Deploy Produção, 6.7 Release Notes, 6.8 Documentação Operacional, 6.9 Health Checks, 6.10 Backup, 6.11 Disaster Recovery, 6.12 Deploy Validation, 6.13 Production Certification |
| Escopo excluído | Qualquer mudança estrutural sem ADR; deploy em produção sem autorização; aplicação de migration em PROD sem autorização; Fase 7 (Product Maturity) e Fase 8 (Commercial Scalability) — não iniciadas |
| Checkpoint inicial | STOP/GATE após CLASSIFY (liberado por PO em 2026-10-23) → ISOLATE autorizado |
| Worktree path | C:\SMG\04_PRODUTOS\SMG_BARBER\sou-manager-fase6-worktree |
| Worktree branch | feat/fase6-production-readiness (base main `5fef539`) |
| Commit de implementação | 01ac9e5 (feat/fase6-production-readiness, worktree) |
| Validação | ✅ `git diff --check` limpo · `architecture:ci` PASS (0 erros; violations 222→218) · commit executado |
| PR | não criado |
| CI/E2E | não executado para esta front |
| Merge SHA | não aplicável |
| Deploy | não autorizado (MERGE ≠ DEPLOY PROD — ADR-026) |
| Post-deploy verdict | não aplicável |
| Estado atual | **COMMIT concluído · STOP/GATE — aguarda autorização do PO para PUSH** |

## Subfases e status (PROJECT_STATUS.md, última atualização 2026-10-09)

| Subfase | Status | Observação |
|---------|--------|------------|
| 6.1 CI/CD | 0% | Não iniciada |
| 6.2 Observabilidade | 0% | Não iniciada |
| 6.3 Ambientes | 0% | Não iniciada |
| 6.4 Hardening | 0% | Não iniciada |
| 6.5 E2E Críticos | 0% | Não iniciada |
| 6.6 Deploy Produção | 0% | Não iniciada |
| 6.7 Release Notes | 0% | Não iniciada |
| 6.8 Documentação Operacional | 0% | Não iniciada |
| 6.9 Health Checks | 0% | Não iniciada |
| 6.10 Backup | 0% | Não iniciada |
| 6.11 Disaster Recovery | 0% | Não iniciada |
| 6.12 Deploy Validation | 0% | Não iniciada |
| 6.13 Production Certification | 0% | Não iniciada |

## Estado geral do projeto

- Arquitetura: estabilizada e congelada (Fase 2 FROZEN, Architecture Freeze concluída Fase 4)
- Roadmap: congelado desde 2026-07-24 (decisões D1–D9)
- Produção: bloqueada (MERGE ≠ DEPLOY PROD — ADR-026)
- Última janela de deploy executada: 2026-08-08 (6 migrations aplicadas, pós-deploy 7/7, E2E verdes)
- Pendente: homologação Sanchez Barber (gate D-HOM) + 6.0.6 Compliance & Legal (gate obrigatório da release v1.5)
- Dívidas técnicas abertas: D4 (papéis), D6 (bootstrap Fase 4 runtime), D8 (dispatcher client-side)

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
| 2026-10-23 | INTAKE | Sisyphus | Front identificado, escopo definido |
| 2026-10-23 | AUDIT | Sisyphus | Estado do projeto verificado via ROADMAP.md + PROJECT_STATUS.md |
| 2026-10-23 | CLASSIFY | Sisyphus | Classificado: front de implementação, escopo Fase 6, baixo risco arquitetural (não altera arquitetura congelada), alto risco operacional (deploy/produção) |
| 2026-10-23 | STOP/GATE | Sisyphus | **PARADO — aguarda autorização do PO para iniciar ISOLATE** |

---

## Próxima transição permitida

**ISOLATE** — somente após autorização explícita do PO para iniciar a Fase 6 — Production Readiness.

**Próxima transição permitida:** nenhuma — front encerrada (CLOSE).

**STATUS:** CLOSED
