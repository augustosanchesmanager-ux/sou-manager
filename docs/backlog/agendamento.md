# Frente: Agendamento & Recorrência

- **Domínio:** Agenda Interna, Sync Agenda ↔ Comanda, Bloqueios, Concorrência de Checkout, Agendamento Público (`/agendar/:slug`) e Club dos Chefes
- **Stack:** React 19 · TypeScript 5.8 · Supabase (PostgreSQL + RLS + RPCs) · Vitest / Playwright
- **Referências obrigatórias:** `AGENTS.md`, `docs/SPEC_RPC_AGENDAMENTO_ONLINE_PUBLICO.md`

---

## Índice da Frente

| ID | Título | Prioridade | Issue | Status |
|---|---|---|---|---|
| `AGD-001` | Isolar/remover mock `"Barbearia Dom Zé"` do bundle de Agendamento Público (`/agendar/:slug`) (`PR #409`) | `P0` | [#385](https://github.com/augustosanchesmanager-ux/sou-manager/issues/385) | `REVIEW` |
| `AGD-002` | **P1-02:** Unificar Sync Agenda ↔ Comanda (3 caminhos → 1) e blindar concorrência no Checkout (`PR #422`) | `P1` | [#388](https://github.com/augustosanchesmanager-ux/sou-manager/issues/388) | `REVIEW` |

---

## `AGD-001` — Isolar/remover mock `"Barbearia Dom Zé"` do bundle de Agendamento Público

- **Status:** `REVIEW` (`PR #409` mergeado na `main`; aguardando deploy controlado em produção)
- **Prioridade:** `P0`
- **GitHub Issue:** [#385](https://github.com/augustosanchesmanager-ux/sou-manager/issues/385)
- **Sprint:** Sprint 1
- **Tipo:** `Bugfix`
- **Dependências:** Nenhuma

### Problema / Objetivo
Na verificação da Sprint 0 em `src/pages/public/booking/hooks/bookingService.ts:43-67`, confirmou-se que `allowMockFallback()` só ativa quando faltam env vars do Supabase ou `VITE_ENABLE_BOOKING_MOCK=true`. Entretanto, ~616 linhas de dados fictícios (`mockData.ts` / `mockService.ts` — `"Barbearia Dom Zé"`) seguem importadas estaticamente no bundle de produção e podem mascarar erro de configuração de deploy.

### Critérios de Aceite
- [ ] Em build de produção, erro `42883` ou falha de RPC nunca cai em dados fictícios e exibe indisponibilidade real.
- [ ] `mockData`/`mockService` isolados exclusivamente para `DEV`/testes (tree-shaken do bundle de produção).
- [ ] `npm run smg:verify` verde.

---

## `AGD-002` — P1-02: Unificar Sync Agenda ↔ Comanda (3 caminhos → 1) e blindar concorrência no Checkout

- **Status:** `REVIEW` (`PR #422` mergeado na `main`; aguardando deploy controlado em produção)
- **Prioridade:** `P1`
- **GitHub Issue:** [#388](https://github.com/augustosanchesmanager-ux/sou-manager/issues/388)
- **Sprint:** Sprint 4
- **Tipo:** `Refactor / Hardening`
- **Dependências:** Auditoria SQL prévia das RPCs de produção + eventual migration para `FOR UPDATE` / `idempotency_key`

### Problema / Objetivo
1. `pages/Schedule.tsx` dispara **3 caminhos distintos de escrita** para sincronizar Agenda ↔ Comanda (`application/appointment/comandaSync.ts`, `services/appointmentComandaSyncService.ts` via RPC e `services/comandaScheduleSyncService.ts` direto).
2. Falta garantia auditada de lock pessimista (`FOR UPDATE`) e trava contra clique duplo no fechamento de comanda/PDV em `pages/Checkout.tsx`.

### Critérios de Aceite
- [ ] `Schedule.tsx` utiliza 1 único Application Service (`application/appointment/`) delegado à RPC atômica.
- [ ] Duplo clique no fechamento de comanda/PDV gera exatamente 1 transação e 1 movimentação de estoque/crédito.
- [ ] Testes de concorrência e integração verdes.
