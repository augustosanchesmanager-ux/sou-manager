# Backlog Oficial — SMG Barber (SSOT)

> **Fonte Única de Verdade (Single Source of Truth)** para o backlog operacional e técnico do SMG Barber.
> Leia este índice e **apenas o arquivo da frente ativa** antes de iniciar qualquer implementação.
> **Norte atual (PO, 2026-11-25):** Sprints 1–5+ e estabilização (`F-01`–`F-03`, `P0`, `P1` e `P2`) mergeadas na `main` (`PRs #369–#440`); todas em `REVIEW` aguardando deploy controlado em produção (`MERGE ≠ DEPLOY PROD`).

---

## Legenda de Status

| Status | Significado |
|---|---|
| `TODO` | Item especificado e priorizado, aguardando início. |
| `IN_PROGRESS` | Em execução na branch dedicada da frente. |
| `BLOCKED` | Bloqueado por dependência técnica, decisão de produto ou autorização do PO. |
| `REVIEW` | Implementação e validação local concluídas; aguardando revisão/PR ou deploy controlado. |
| `DONE` | Mergeado/validado com evidência verificável registrada na frente. |

---

## Prioridades Atuais — Em Review + Frentes P0 (Bloqueantes de Venda)

| ID | Frente | Título | Issue | Sprint | Status | Dependências |
|---|---|---|---|---|---|---|
| `SEC-001` | [Segurança & RLS](./seguranca-rls.md) | **F-01:** Trava de sessão e circuit breaker em `AuthContext` (`PR #369` mergeado; deploy PROD pendente) | — | Deploy | `REVIEW` | Aprovação PO no `deploy-production.yml` |
| `FIN-001` | [Financeiro & Comissões](./financeiro.md) | **F-02:** Guard de sessão e circuit breaker no polling do outbox (`PR #374` mergeado) | — | Deploy | `REVIEW` | Deploy controlado em produção |
| `SEC-002` | [Segurança & RLS](./seguranca-rls.md) | **F-03:** Alinhar drift de schema exposto (`Accept-Profile` / `Content-Profile`) (`PR #375` mergeado) | — | Deploy | `REVIEW` | Camada B no Dashboard Supabase (PO) + deploy PROD |
| `SEC-006` | [Segurança & RLS](./seguranca-rls.md) | **P0-01:** Hardening final de RLS, Grants e reconciliação de Produção (`PR #407` mergeado) | [#376](https://github.com/augustosanchesmanager-ux/sou-manager/issues/376) | Sprint 1 | `REVIEW` | Aprovação PO para migration/deploy em PROD (`DEC-10`) |
| `SEC-007` | [Segurança & RLS](./seguranca-rls.md) | **P0-02:** Blindar guards (`ManagerRoute` allow-list), `CommandPalette` e filtro `tenant_id` (`PR #405` mergeado) | [#377](https://github.com/augustosanchesmanager-ux/sou-manager/issues/377) | Sprint 1 | `REVIEW` | Deploy controlado em produção |
| `GTM-005` | [Go-To-Market & Produto](./go-to-market.md) | **P0-03:** Remover mocks ativos (`/orders/:id`, `/event-versioning`), restringir `/observability` e fail-fast demo (`PR #406` mergeado) | [#378](https://github.com/augustosanchesmanager-ux/sou-manager/issues/378) | Sprint 1 | `REVIEW` | Deploy controlado em produção |
| `GTM-006` | [Go-To-Market & Produto](./go-to-market.md) | **P0-04:** Corrigir links públicos (`/booking/:slug`, `Clients`, `Landing`) e reset de senha (`HashRouter`) (`PR #408` mergeado) | [#379](https://github.com/augustosanchesmanager-ux/sou-manager/issues/379) | Sprint 1 | `REVIEW` | Deploy controlado em produção |
| `AGD-001` | [Agendamento & Recorrência](./agendamento.md) | Isolar/remover mock `"Barbearia Dom Zé"` do bundle de Agendamento Público (`/agendar/:slug`) (`PR #409` mergeado) | [#385](https://github.com/augustosanchesmanager-ux/sou-manager/issues/385) | Sprint 1 | `REVIEW` | Deploy controlado em produção |
| `GTM-003` | [Go-To-Market & Produto](./go-to-market.md) | Limpar resíduos de `/automations` simulada em `localStorage` ou definir backend real (`PR #410` mergeado) | [#386](https://github.com/augustosanchesmanager-ux/sou-manager/issues/386) | Sprint 1 | `REVIEW` | Deploy controlado em produção |
| `GTM-001` | [Go-To-Market & Produto](./go-to-market.md) | **P0-05:** Eliminar split-brain de planos, conectar CTA `Upgrade`, unificar Billing Stack (ADR) e Stripe (`PR #411` mergeado) | [#380](https://github.com/augustosanchesmanager-ux/sou-manager/issues/380) | Sprint 2 | `REVIEW` | Deploy controlado em produção |
| `FIN-002` | [Financeiro & Comissões](./financeiro.md) | **P0-06 (`+GTM-002`):** Sanear métricas fabricadas em `/bi`, hardcodes e fuso `UTC` vs `BRT` / `closed_at` (`PR #413` mergeado) | [#381](https://github.com/augustosanchesmanager-ux/sou-manager/issues/381) | Sprint 2 | `REVIEW` | Deploy controlado em produção |
| `FIN-005` | [Financeiro & Comissões](./financeiro.md) | **P0-07:** Migrar `/categories` e políticas de taxa (`cardFeeRepository`) de `localStorage` para Supabase (`PR #412` mergeado) | [#382](https://github.com/augustosanchesmanager-ux/sou-manager/issues/382) | Sprint 2 | `REVIEW` | Aprovação PO (migration + deploy PROD) |
| `GTM-007` | [Go-To-Market & Produto](./go-to-market.md) | **P0-08 (`+SEC-004`):** Reconstruir `/superadmin` (MVP Operacional) e remover `pages/Admin.tsx` (`PR #414` mergeado) | [#383](https://github.com/augustosanchesmanager-ux/sou-manager/issues/383) | Sprint 3 | `REVIEW` | Deploy controlado em produção |
| `GTM-008` | [Go-To-Market & Produto](./go-to-market.md) | **P0-09:** Implementar Compliance Jurídico & LGPD Mínimo Viável (Fase 6.0.6) (`PR #415` mergeado) | [#384](https://github.com/augustosanchesmanager-ux/sou-manager/issues/384) | Sprint 3 | `REVIEW` | Aprovação PO (migration + deploy PROD) |

---

## Frentes P1 — Estabilização e Escala (Sprint 4)

| ID | Frente | Título | Issue | Status | Dependências |
|---|---|---|---|---|---|
| `FIN-006` | [Financeiro & Comissões](./financeiro.md) | **P1-01:** Consolidar `useFeatureFlags` (20 RPCs → 1 RPC Batch) e higiene de cache (`PR #416` mergeado) | [#387](https://github.com/augustosanchesmanager-ux/sou-manager/issues/387) | `REVIEW` | Aprovação PO (RPC batch em PROD + deploy) |
| `AGD-002` | [Agendamento & Recorrência](./agendamento.md) | **P1-02:** Unificar Sync Agenda ↔ Comanda (3 caminhos → 1) e blindar concorrência no Checkout (`PR #422` mergeado) | [#388](https://github.com/augustosanchesmanager-ux/sou-manager/issues/388) | `REVIEW` | Deploy controlado em produção |
| `UXQ-001` | [UX, Layout & Qualidade](./ux-qualidade.md) | **P1-03:** Unificar telas redundantes (BI/Estratégico, Fornecedores, Maquininhas, Financeiro, Portal) (`PR #423` mergeado) | [#389](https://github.com/augustosanchesmanager-ux/sou-manager/issues/389) | `REVIEW` | Deploy controlado em produção |
| `UXQ-002` | [UX, Layout & Qualidade](./ux-qualidade.md) | **P1-04:** UX segura (confirmação destrutiva, fim de `alert()`/`confirm()` e `catch {}` silenciosos) (`PR #421` mergeado) | [#390](https://github.com/augustosanchesmanager-ux/sou-manager/issues/390) | `REVIEW` | Deploy controlado em produção |
| `UXQ-003` | [UX, Layout & Qualidade](./ux-qualidade.md) | **P1-05:** Corrigir Layout (Sidebar dupla, escala única de `z-index`, Header e `Modal` aninhado) (`PR #419` mergeado) | [#391](https://github.com/augustosanchesmanager-ux/sou-manager/issues/391) | `REVIEW` | Deploy controlado em produção |
| `UXQ-004` | [UX, Layout & Qualidade](./ux-qualidade.md) | **P1-06 (`+SEC-003`):** Memoizar Contexts, alinhar `pendingRegistration` e isolar `ErrorBoundary`/`Suspense` (`PR #417` mergeado) | [#392](https://github.com/augustosanchesmanager-ux/sou-manager/issues/392) | `REVIEW` | Deploy controlado em produção |
| `UXQ-005` | [UX, Layout & Qualidade](./ux-qualidade.md) | **P1-07:** Corrigir bugs pontuais (`Operations.tsx`, `Reports` co-execução e rótulos ADR-001/030) (`PR #418` mergeado) | [#393](https://github.com/augustosanchesmanager-ux/sou-manager/issues/393) | `REVIEW` | Deploy controlado em produção |
| `UXQ-006` | [UX, Layout & Qualidade](./ux-qualidade.md) | **P1-08:** Fechar ponto cego de Lint (`biome` na raiz) e reconciliar workflow de CI (`ADR-024`) (`PR #434` mergeado) | [#394](https://github.com/augustosanchesmanager-ux/sou-manager/issues/394) | `REVIEW` | Deploy controlado em produção |
| `SEC-005` | [Segurança & RLS](./seguranca-rls.md) | Gate de deploy pré-atribuição (`ADR-049` em `deploy-production.yml`) (`PR #434` mergeado) | [#395](https://github.com/augustosanchesmanager-ux/sou-manager/issues/395) | `REVIEW` | Validação na próxima execução de `deploy-production.yml` |
| `FIN-003` | [Financeiro & Comissões](./financeiro.md) | Corrigir timeouts em `fiscalService.test.ts` / `stockRepository.test.ts` e escopo NFS-e (`PR #420` mergeado) | [#396](https://github.com/augustosanchesmanager-ux/sou-manager/issues/396) | `REVIEW` | Deploy controlado em produção |

---

## Frentes P2 — Evolução e Limpeza (Sprint 5+)

| ID | Frente | Título | Issue | Status | Dependências |
|---|---|---|---|---|---|
| `UXQ-007` | [UX, Layout & Qualidade](./ux-qualidade.md) | **P2-01:** Decomposição incremental dos 4 super-monólitos (`Schedule`, `Checkout`, `Receivable`, `Comandas`) (`PRs #428–#431` mergeados) | [#397](https://github.com/augustosanchesmanager-ux/sou-manager/issues/397) | `REVIEW` | Deploy controlado em produção |
| `UXQ-008` | [UX, Layout & Qualidade](./ux-qualidade.md) | **P2-02:** Migrar 11 `application/` services diretos no Supabase para Repository Pattern (`ADR-056`, `PRs #436, #438, #439` mergeados) | [#398](https://github.com/augustosanchesmanager-ux/sou-manager/issues/398) | `REVIEW` | Deploy controlado em produção |
| `UXQ-009` | [UX, Layout & Qualidade](./ux-qualidade.md) | **P2-03:** Eliminação progressiva dos 560 `any` e consolidação de utilitários (`timezone`, `currency`) (`PRs #425–#427` mergeados) | [#399](https://github.com/augustosanchesmanager-ux/sou-manager/issues/399) | `REVIEW` | Deploy controlado em produção |
| `UXQ-010` | [UX, Layout & Qualidade](./ux-qualidade.md) | **P2-04:** Limpeza de código morto (~38% exports, páginas órfãs) e condicionais `estetica` na UI (`PR #424` mergeado) | [#400](https://github.com/augustosanchesmanager-ux/sou-manager/issues/400) | `REVIEW` | Deploy controlado em produção |
| `GTM-009` | [Go-To-Market & Produto](./go-to-market.md) | **P2-05:** Super Admin Avançado (Executive MRR/Churn, `SupabaseMonitoring` real e Exports LGPD) (`PR #433` mergeado) | [#401](https://github.com/augustosanchesmanager-ux/sou-manager/issues/401) | `REVIEW` | Deploy controlado em produção |
| `FIN-004` | [Financeiro & Comissões](./financeiro.md) | Alinhar Staging e `config.toml` da exportação Excel (`import-export`) (`PR #432` mergeado) | [#402](https://github.com/augustosanchesmanager-ux/sou-manager/issues/402) | `REVIEW` | Deploy controlado em produção |
| `GTM-004` | [Go-To-Market & Produto](./go-to-market.md) | SMG Barber Intelligence — Fase 1 (`ai-analyst` + `ai_insights` + `ADR-050`) (`PR #440` mergeado) | [#403](https://github.com/augustosanchesmanager-ux/sou-manager/issues/403) | `REVIEW` | Aprovação PO (migration/Edge Function + deploy PROD) |

---

## Mapa de Frentes

| Frente | Domínio | Arquivo | Escopo |
|---|---|---|---|
| **Segurança, Multi-tenant & RLS** | Autenticação, isolamento `tenant_id`, RLS, grants e guards | [seguranca-rls.md](./seguranca-rls.md) | `F-01`, `F-03`, `SEC-003..007` (`P0-01`, `P0-02`) |
| **Go-To-Market & Produto** | Billing/Stripe, Zero Mock, Links, Super Admin, LGPD e AI | [go-to-market.md](./go-to-market.md) | `GTM-001..009` (`P0-03..05`, `P0-08`, `P0-09`, `P2-05`) |
| **Financeiro & Comissões** | Caixa, BI/fuso, Fiscal, Feature Flags e persistência | [financeiro.md](./financeiro.md) | `F-02`, `FIN-002..006` (`P0-06`, `P0-07`, `P1-01`) |
| **Agendamento & Recorrência** | Agenda, sync comanda, concorrência e agendamento público | [agendamento.md](./agendamento.md) | `AGD-001`, `AGD-002` (`P1-02`) |
| **UX, Layout & Qualidade** | Unificações, stacking/`z-index`, contexts, monólitos, lint e limpeza | [ux-qualidade.md](./ux-qualidade.md) | `UXQ-001..010` (`P1-03..08`, `P2-01..04`) |
| **Arquivo Histórico** | Itens `DONE` há mais de 30 dias | [_ARCHIVE.md](./_ARCHIVE.md) | Histórico consolidado |
