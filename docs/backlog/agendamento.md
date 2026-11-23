# Frente: Agendamento & Recorrência

- **Domínio:** Agenda Interna, Bloqueios, Agendamento Público (`/agendar/:slug`) e Recorrência / Club dos Chefes
- **Stack:** React 19 · TypeScript 5.8 · Supabase (PostgreSQL + RLS + RPCs) · Vitest / Playwright
- **Referências obrigatórias:** `AGENTS.md`, `docs/SPEC_RPC_AGENDAMENTO_ONLINE_PUBLICO.md`

---

## Índice da Frente

| ID | Título | Prioridade | Status |
|---|---|---|---|
| `AGD-001` | Remover fallback silencioso para `mockService.ts` no Agendamento Público (`/agendar/:slug`) | `P0` | `TODO` |

---

## `AGD-001` — Remover fallback silencioso para `mockService.ts` no Agendamento Público

- **Status:** `TODO`
- **Prioridade:** `P0`
- **Tipo:** `Bugfix`
- **Dependências:** Nenhuma

### Problema / Objetivo
Em `src/pages/public/booking/hooks/bookingService.ts:87-103`, se a RPC pública retornar erro `42883`, o serviço cai silenciosamente em `mockService.ts`, exibindo confirmação de agendamento ao cliente final sem gravar no banco de dados.

### Escopo Técnico
- `src/pages/public/booking/hooks/bookingService.ts` (remover fallback para `mockService.ts` em erro de RPC e propagar erro explícito tratável pela UI).
- Verificar se há outros consumidores de `mockService.ts` fora do Local Demo Mode (`isLocalDemoEnabled()`).

### Critérios de Aceite
- [ ] Zero fallback silencioso para dados mockados quando houver erro de RPC em ambiente real.
- [ ] Erro `42883` ou falha de RPC exibe mensagem clara de indisponibilidade sem falso sucesso.
- [ ] Isolamento multi-tenant (`tenant_id` / RLS) preservado.
- [ ] `npm run typecheck`, `npm run lint`, `npm run test` e `npm run build` passando.

### Evidência de Validação
- **Branch / PR:** —
- **Testes / Build:** —
- **Observações:** Bloqueador P0 identificado na Auditoria Go-To-Market (`docs/audit-go-to-market/SMG_AUDITORIA_COMPLETA.md`).
