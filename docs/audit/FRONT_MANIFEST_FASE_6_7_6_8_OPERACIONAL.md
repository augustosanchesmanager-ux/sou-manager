# Front Manifest — Fase 6.7 e 6.8: Documentação Operacional & Release Notes

> Protocolo: SMG Change Control v1.0.0 (INTAKE → ISOLATE → AUDIT → CLASSIFY → STOP/GATE → IMPLEMENT → VALIDATE → …)
> Conforme `docs/adr/ADR-028-smg-gate-formal-contract.md` e `.opencode/SMG_CHANGE_CONTROL.md`
> Data: 2026-10-24
> Autor: Antigravity (Google DeepMind)
> Base: `main` (commit `d8301c0` — merge do PR #177)

## Identificação

| Campo | Valor |
|-------|-------|
| Front ID | FASE-6.7-6.8-OPERACIONAL-RELEASE |
| Fase | Fase 6 — Production Readiness |
| Subfase | 6.7 Release Notes & 6.8 Documentação Operacional |
| Base | `main` @ `d8301c0` |
| Branch | `docs/fase6-6-7-6-8-operacional-release` |
| Worktree | `C:\SMG\04_PRODUTOS\SMG_BARBER\sou-manager-fase6-operacional` |
| Escopo desta etapa | INTAKE, ISOLATE, AUDIT e CLASSIFY dos runbooks operacionais e padrão de Release Notes |
| Escopo excluído | Alteração em código de produto (`src/**`), schemas de banco, RPCs, regras de negócio |
| Estado atual | **AUDIT / CLASSIFY concluído — pronto para implementação documental** |

---

## 1. Inventário de Documentação Operacional Existente — EVIDENCE

1. **Runbooks Existentes em `docs/runbooks/`:**
   - `ci-gate-override.md`: Procedimento de override de falhas estritamente de infraestrutura no CI.
   - `P-AUTO_PROMOTE_RUNBOOK.md`: Protocolo de promoção para Produção com Vercel + Playwright Smoke Test.
2. **Documentação de Release Existente em `docs/`:**
   - `RELEASE_PROCESS.md`: Visão geral do fluxo de entrega (vitest, build, smoke, rollback, release notes).
   - `RELEASE_CHECKLIST_v1.5.md`: Checklist exaustivo para a release v1.5.0.

---

## 2. Lacunas Operacionais da Fase 6 — GAPS & REQUIREMENTS

1. **Subfase 6.7 — Release Notes:**
   - Ausência de um template canônico e padronizado em Markdown (`docs/release-notes/RELEASE_NOTES_TEMPLATE.md`).
   - Falta do documento oficial consolidado de release da versão ativa `v1.5.0` (`docs/release-notes/RELEASE_NOTES_v1.5.0.md`), detalhando melhorias de governança, P-AUTO, E2E críticos (P1, P2, P3), health checks padronizados e matriz de ambientes.
2. **Subfase 6.8 — Documentação Operacional & Runbooks:**
   - **Gestão de Incidentes & Rollback (`docs/runbooks/INCIDENT_MANAGEMENT.md`):** Classificação de severidade (P0 a P3), SLA de resposta, procedimento de rollback no Vercel (instant rollback) e mitigação no Supabase.
   - **Rotação de Segredos & Credenciais (`docs/runbooks/SECRET_ROTATION.md`):** Guia operacional de rotação de chaves Anon/Service Role, custom secrets do Edge Runtime (`EDGE_JWT_SECRET`, `APP_URL`), Vercel environment variables e GitHub Actions secrets.
   - **Operações do Worker de Outbox D8 & pg_cron (`docs/runbooks/D8_OPERATIONS.md`):** Monitoramento de jobs no pg_cron, checagem da role `worker_dispatcher`, verificação de integridade via `npm run d8:verify`, diagnóstico de erro 503 e protocolo de destravamento de outbox.

---

## 3. Classificação de Risco

- **Tipo:** `docs / operational-hardening`
- **Impacto em Produção:** Zero (arquivos markdown em `docs/runbooks/` e `docs/release-notes/`).
- **Riscos Arquiteturais:** Nulo.
