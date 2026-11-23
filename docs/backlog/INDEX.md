# Backlog Oficial — SMG Barber (SSOT)

> **Fonte Única de Verdade (Single Source of Truth)** para o backlog operacional e técnico do SMG Barber.
> Leia este índice e **apenas o arquivo da frente ativa** antes de iniciar qualquer implementação.
> **Norte atual (PO, 2026-11-23):** 1º Estabilizar produção (`F-01`, `F-02`, `F-03`) → 2º Destravar bloqueadores P0 de Go-To-Market.

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

## Prioridades Atuais (Foco da Sprint)

| ID | Frente | Título | Prioridade | Status | Dependências |
|---|---|---|---|---|---|
| `SEC-001` | [Segurança & RLS](./seguranca-rls.md) | **F-01:** Trava de sessão e circuit breaker em `AuthContext` (PR #369 mergeado; deploy PROD pendente) | `P0` | `REVIEW` | Aprovação PO no `deploy-production.yml` |
| `FIN-001` | [Financeiro & Comissões](./financeiro.md) | **F-02:** Guard de sessão e circuit breaker no polling do outbox (`fix/f02-outbox-auth-guard`) | `P0` | `REVIEW` | PR + merge em `main` + deploy |
| `SEC-002` | [Segurança & RLS](./seguranca-rls.md) | **F-03:** Alinhar drift de schema exposto no `.env.local` (`Accept-Profile` / `404 PGRST202`) | `P0` | `TODO` | — |
| `AGD-001` | [Agendamento & Recorrência](./agendamento.md) | Remover fallback silencioso para `mockService.ts` no Agendamento Público (`/agendar/:slug`) | `P0` | `TODO` | — |
| `GTM-001` | [Go-To-Market & Produto](./go-to-market.md) | Billing Self-Serve (Stripe Checkout) + destravar plano inicial (`maxStaff: 1`) | `P0` | `TODO` | Decisão comercial do PO sobre planos/preços |
| `GTM-002` | [Go-To-Market & Produto](./go-to-market.md) | Remover strings hardcoded de cliente único (`"Sanchez Barber"`, `"Rubens, Heron, Lucas"`) do BI | `P0` | `TODO` | — |
| `GTM-003` | [Go-To-Market & Produto](./go-to-market.md) | Substituir Central de Automações (`/automations`) simulada em `localStorage` por fluxo real ou desativar | `P0` | `TODO` | Decisão do PO (implementar vs ocultar pré-GTM) |
| `SEC-003` | [Segurança & RLS](./seguranca-rls.md) | **E-7:** Memoizar `refreshAccessContext` em `AuthContext.tsx` (`AcceptInvite.tsx:53`) | `P1` | `TODO` | `SEC-001` |
| `SEC-004` | [Segurança & RLS](./seguranca-rls.md) | Migrar `/admin` para `SuperAdminRoute` e remover `supabase.auth.admin` do browser | `P1` | `TODO` | — |
| `FIN-002` | [Financeiro & Comissões](./financeiro.md) | Corrigir virada de data UTC vs BRT (`toISOString().split('T')[0]`) em telas financeiras/BI | `P1` | `TODO` | — |

---

## Mapa de Frentes

| Frente | Domínio | Arquivo | Responsável / Escopo |
|---|---|---|---|
| **Segurança, Multi-tenant & RLS** | Autenticação, isolamento `tenant_id`, RPCs e hardening | [seguranca-rls.md](./seguranca-rls.md) | `F-01`, `F-03`, `E-7`, `/admin` e Gate Pré-Atribuição (`ADR-049`) |
| **Financeiro & Comissões** | Caixa, comandas, comissões (ADR-001), outbox D8 e fiscal | [financeiro.md](./financeiro.md) | `F-02`, fuso horário financeiro, Fiscal/Estoque e Staging `exports` |
| **Agendamento & Recorrência** | Agenda, bloqueios, agendamento público e Club dos Chefes | [agendamento.md](./agendamento.md) | Agendamento público sem fallback mock, slots e recorrência |
| **Go-To-Market & Produto** | Self-serve Stripe, zero-mock, BI e novas features (AI) | [go-to-market.md](./go-to-market.md) | Bloqueadores GTM da auditoria 2026-11-20 e `ADR-050` |
| **Arquivo Histórico** | Itens `DONE` há mais de 30 dias | [_ARCHIVE.md](./_ARCHIVE.md) | Histórico consolidado para manter as frentes enxutas |
